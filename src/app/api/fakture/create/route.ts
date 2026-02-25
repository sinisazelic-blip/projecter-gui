// src/app/api/fakture/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseIds(idsRaw: string | null): number[] {
  if (!idsRaw) return [];
  return idsRaw
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function POST(req: NextRequest) {
  const conn = await (pool as any).getConnection();

  try {
    await conn.beginTransaction();

    const body = await req.json();
    const {
      ids, // projekat_id lista
      date, // datum fakture (ISO: YYYY-MM-DD)
      ccy, // valuta
      vat, // BH_17 ili INO_0
      pfr, // PFR broj (opciono, ako nije dat, generiše se)
      pnb, // poziv na broj (8 cifara)
      popust, // popust prije PDV-a (KM)
      project_names, // override nazivi projekata (format: "id:naziv,id2:naziv2")
      project_sub_items, // opisne stavke (format: "id:item1|item2,id2:item1")
    } = body;

    const projekatIds = parseIds(ids);
    if (projekatIds.length === 0) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Nedostaju projekat_id" },
        { status: 400 },
      );
    }

    // Validacija datuma
    const datumFakture = date ? String(date).trim().slice(0, 10) : null;
    if (!datumFakture || !/^\d{4}-\d{2}-\d{2}$/.test(datumFakture)) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Neispravan datum fakture" },
        { status: 400 },
      );
    }

    // Validacija poziva na broj
    if (!pnb || !/^\d{8}$/.test(String(pnb))) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Poziv na broj mora biti 8 cifara" },
        { status: 400 },
      );
    }

    // 1) Učitaj projekte i proveri da su svi status 8 (Zatvoren - spremni za fakturisanje)
    const [projektiRows]: any = await conn.query(
      `
      SELECT 
        p.projekat_id,
        p.narucilac_id,
        p.status_id,
        COALESCE(p.pro_bono, 0) AS pro_bono,
        k.rok_placanja_dana,
        vf.budzet_planirani
      FROM projekti p
      LEFT JOIN klijenti k ON k.klijent_id = p.narucilac_id
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      WHERE p.projekat_id IN (${projekatIds.map(() => "?").join(",")})
      FOR UPDATE
      `,
      projekatIds,
    );

    if (!projektiRows || projektiRows.length !== projekatIds.length) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Neki projekti nisu pronađeni" },
        { status: 404 },
      );
    }

    // Proveri da su svi status 8 (Zatvoren)
    const notReady = projektiRows.filter((p: any) => p.status_id !== 8);
    if (notReady.length > 0) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error: `Neki projekti nisu spremni za fakturisanje (status mora biti 8 - Zatvoren)`,
          projekti: notReady.map((p: any) => ({
            id: p.projekat_id,
            status: p.status_id,
          })),
        },
        { status: 400 },
      );
    }

    // ProBono projekti se nikad ne fakturišu
    const proBonoProjekti = projektiRows.filter((p: any) => Number(p.pro_bono || 0) === 1);
    if (proBonoProjekti.length > 0) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error: `ProBono projekti se ne fakturišu. Uklonite iz liste: ${proBonoProjekti.map((p: any) => p.projekat_id).join(", ")}`,
          projekti: proBonoProjekti.map((p: any) => p.projekat_id),
        },
        { status: 400 },
      );
    }

    // Proveri da su svi isti naručioc
    const narucioci = Array.from(
      new Set(projektiRows.map((p: any) => p.narucilac_id).filter(Boolean)),
    );
    if (narucioci.length !== 1) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Svi projekti moraju imati istog naručioca" },
        { status: 400 },
      );
    }

    const narucilacId = narucioci[0];
    const rokPlacanjaDana =
      Number(projektiRows[0]?.rok_placanja_dana) || 30;

    // 2) Izračunaj datum dospijeća
    const datumDospijeca = new Date(datumFakture);
    datumDospijeca.setDate(datumDospijeca.getDate() + rokPlacanjaDana);
    const datumDospijecaStr = datumDospijeca.toISOString().slice(0, 10);

    // 3) Generiši broj fakture (format: 001/2026)
    const godina = new Date(datumFakture).getFullYear();

    // Sljedeći broj = max(MAX iz fakture, početna vrijednost iz brojac_faktura) + 1
    let maxIzFakture = 0;
    try {
      const [lastRows]: any = await conn.query(
        `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?`,
        [godina],
      );
      maxIzFakture = Number(lastRows?.[0]?.m ?? 0) || 0;
    } catch {
      maxIzFakture = 0;
    }

    let brojacZadnji = 0;
    try {
      const [brojacRows]: any = await conn.query(
        `SELECT zadnji_broj_u_godini FROM brojac_faktura WHERE godina = ? LIMIT 1`,
        [godina],
      );
      brojacZadnji = Number(brojacRows?.[0]?.zadnji_broj_u_godini ?? 0) || 0;
    } catch {
      brojacZadnji = 0;
    }

    const sledeciBroj = Math.max(maxIzFakture, brojacZadnji) + 1;

    // Ažuriraj brojac_faktura (best-effort, za buduće pozive)
    try {
      await conn.query(
        `INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE zadnji_broj_u_godini = GREATEST(zadnji_broj_u_godini, ?)`,
        [godina, sledeciBroj, sledeciBroj],
      );
    } catch {
      // brojac_faktura ne postoji — ignoriši
    }

    // broj_fakture_puni je GENERATED kolona, ne treba ga unositi
    // Format će biti: broj_u_godini/godina (npr. 001/2026)

    // 4) Generiši PFR broj (ako nije dat)
    let pfrBroj = pfr ? Number(pfr) : null;
    if (!pfrBroj) {
      try {
        const [pfrRows]: any = await conn.query(
          `SELECT MAX(broj_fiskalni) AS max_pfr FROM fakture WHERE broj_fiskalni IS NOT NULL`,
        );
        const maxPfr = Number(pfrRows?.[0]?.max_pfr ?? 0);
        pfrBroj = maxPfr + 1;
      } catch (err: any) {
        // Ako tabela fakture ne postoji ili nema podataka, počni od 1
        pfrBroj = 1;
      }
    }

    // 5) Izračunaj iznose (sa ili bez PDV-a)
    const sumaBudzeta = projektiRows.reduce(
      (sum: number, p: any) => sum + (Number(p.budzet_planirani) || 0),
      0,
    );
    const popustKm = Math.max(0, Number(popust) || 0);
    const osnovicaKm = Math.max(0, sumaBudzeta - popustKm);

    const vatMode = String(vat || "BH_17").toUpperCase();
    const pdvStopa = vatMode === "BH_17" ? 17.0 : 0.0;
    const pdvObracunat = vatMode === "BH_17" ? 1 : 0;
    const pdvIznosKm =
      vatMode === "BH_17"
        ? Math.round(osnovicaKm * (pdvStopa / 100) * 100) / 100
        : 0;
    const iznosUkupnoKm = osnovicaKm + pdvIznosKm;

    // 6) Kreiraj fakturu
    // Koristimo postojeću strukturu tabele fakture:
    // - bill_to_klijent_id (umesto narucilac_id)
    // - osnovica_km (umesto iznos_bez_pdv)
    // - pdv_iznos_km (umesto pdv_iznos)
    // - iznos_ukupno_km (umesto iznos_sa_pdv)
    // - broj_fakture_puni je GENERATED kolona (ne unosimo je)
    // - tip = 'multi' ako ima više projekata, 'obicna' ako jedan
    const tipFakture = projekatIds.length > 1 ? "multi" : "obicna";
    const brojFakture = `${String(sledeciBroj).padStart(3, "0")}/${godina}`;

    let fakturaId: number;
    try {
      const [insertResult]: any = await conn.query(
        `
        INSERT INTO fakture
          (bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni, fiskalni_status,
           datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
           pdv_obracunat, iznos_ukupno_km)
        VALUES (?, ?, ?, ?, 'DODIJELJEN', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          narucilacId,
          godina,
          sledeciBroj,
          pfrBroj,
          datumFakture,
          tipFakture,
          // valuta je enum('BAM','EUR','USD') - mora biti tačno jedan od ovih
          String(ccy || "BAM").toUpperCase() === "KM" ? "BAM" : String(ccy || "BAM").toUpperCase(),
          osnovicaKm,
          pdvStopa,
          pdvIznosKm,
          pdvObracunat,
          iznosUkupnoKm,
        ],
      );
      fakturaId = Number(insertResult.insertId);
    } catch (insertErr: any) {
      await conn.rollback();
      // Proveri da li je greška zbog nepostojanja tabele ili kolone
      const errMsg = String(insertErr?.message || "").toLowerCase();
      const errCode = insertErr?.code || "";
      
      if (
        errMsg.includes("doesn't exist") ||
        errMsg.includes("unknown column") ||
        errCode === "ER_NO_SUCH_TABLE" ||
        errCode === "ER_BAD_FIELD_ERROR"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `Greška u bazi podataka: ${insertErr?.message || "Nepoznata greška"}. ` +
              `Proverite da li je tabela 'fakture' kreirana sa ispravnom strukturom. ` +
              `SQL skripta: scripts/create-fakture.sql`,
            debug: {
              message: insertErr?.message,
              code: insertErr?.code,
              sqlState: insertErr?.sqlState,
            },
          },
          { status: 500 },
        );
      }
      throw insertErr;
    }

    // Parse project_sub_items: "id:item1|item2,id2:item1" -> { id: ["item1","item2"] }
    const subItemsMap: Record<number, string[]> = {};
    if (project_sub_items && typeof project_sub_items === "string") {
      project_sub_items.split(",").forEach((pair: string) => {
        const colonIdx = pair.indexOf(":");
        if (colonIdx <= 0) return;
        const id = Number(pair.slice(0, colonIdx));
        const itemsStr = pair.slice(colonIdx + 1);
        if (!Number.isFinite(id) || !itemsStr) return;
        const items = itemsStr
          .split("|")
          .map((s) => String(s).trim())
          .filter(Boolean);
        if (items.length > 0) subItemsMap[id] = items;
      });
    }

    // Parse project_names: "id:naziv,id2:naziv2" -> { id: "naziv" }
    const projectNamesMap: Record<number, string> = {};
    if (project_names && typeof project_names === "string") {
      project_names.split(",").forEach((pair: string) => {
        const colonIdx = pair.indexOf(":");
        if (colonIdx <= 0) return;
        const id = Number(pair.slice(0, colonIdx));
        const naziv = decodeURIComponent(pair.slice(colonIdx + 1)).trim();
        if (Number.isFinite(id) && naziv) projectNamesMap[id] = naziv;
      });
    }

    // 7) Veži projekte na fakturu (ako tabela faktura_projekti postoji)
    let fakturaProjektiSaved = false;
    try {
      for (const projekatId of projekatIds) {
        const opisneStavke = subItemsMap[projekatId];
        const opisneStavkeJson = opisneStavke && opisneStavke.length > 0
          ? JSON.stringify(opisneStavke)
          : null;
        const nazivNaFakturi = projectNamesMap[projekatId] || null;

        try {
          await conn.query(
            `INSERT INTO faktura_projekti (faktura_id, projekat_id, opisne_stavke, naziv_na_fakturi) VALUES (?, ?, ?, ?)`,
            [fakturaId, projekatId, opisneStavkeJson, nazivNaFakturi],
          );
        } catch (colErr: any) {
          const errMsg = String(colErr?.message || "").toLowerCase();
          if (errMsg.includes("unknown column")) {
            try {
              await conn.query(
                `INSERT INTO faktura_projekti (faktura_id, projekat_id, opisne_stavke) VALUES (?, ?, ?)`,
                [fakturaId, projekatId, opisneStavkeJson],
              );
            } catch (innerErr: any) {
              if (String(innerErr?.message || "").toLowerCase().includes("unknown column")) {
                await conn.query(
                  `INSERT INTO faktura_projekti (faktura_id, projekat_id) VALUES (?, ?)`,
                  [fakturaId, projekatId],
                );
              } else {
                throw innerErr;
              }
            }
          } else {
            throw colErr;
          }
        }
      }
      fakturaProjektiSaved = true;
      console.log(`✅ Veze faktura-projekti sačuvane za fakturu ${fakturaId}, projekti: ${projekatIds.join(", ")}`);
    } catch (linkErr: any) {
      // Ako tabela faktura_projekti ne postoji ili ima problem, logujemo ali ne blokiramo
      // Projekti će biti povezani kroz project_audit log (fallback u API za učitavanje)
      const errMsg = String(linkErr?.message || "").toLowerCase();
      console.warn(`⚠️ Greška pri vezivanju projekata za fakturu ${fakturaId}:`, linkErr?.message);
      console.warn(`   Projekti koji treba da budu povezani: ${projekatIds.join(", ")}`);
      // Ne bacamo grešku - audit log će biti dovoljan za fallback
    }

    // 8) Promeni status projekata sa 8 (Zatvoren) na 9 (Fakturisan)
    await conn.query(
      `
      UPDATE projekti
      SET status_id = 9
      WHERE projekat_id IN (${projekatIds.map(() => "?").join(",")})
      `,
      projekatIds,
    );

    // 9) Audit log za svaki projekat (OVO JE KRITIČNO za fallback učitavanje)
    for (const projekatId of projekatIds) {
      try {
        await conn.query(
          `
          INSERT INTO project_audit (projekat_id, action, details, user_label, ip)
          VALUES (?, 'PROJECT_INVOICED', CAST(? AS JSON), 'SYSTEM', '127.0.0.1')
          `,
          [
            projekatId,
            JSON.stringify({
              faktura_id: fakturaId,
              broj_fakture: brojFakture,
              datum_izdavanja: datumFakture,
            }),
          ],
        );
        console.log(`✅ Audit log kreiran za projekat ${projekatId}, faktura ${fakturaId}`);
      } catch (auditErr: any) {
        console.error(`❌ Greška pri kreiranju audit loga za projekat ${projekatId}:`, auditErr?.message);
        // Ovo je kritično - bez audit loga nećemo moći da nađemo projekte kasnije
        throw new Error(`Neuspelo kreiranje audit loga za projekat ${projekatId}: ${auditErr?.message}`);
      }
    }

    await conn.commit();

    // Koristimo ručno formatiran broj fakture (005/2026) umesto GENERATED kolone
    // jer GENERATED kolona možda ne formatira pravilno
    const brojFaktureFormatiran = `${String(sledeciBroj).padStart(3, "0")}/${godina}`;

    return NextResponse.json({
      ok: true,
      faktura_id: fakturaId,
      broj_fakture: brojFaktureFormatiran,
      broj_fiskalni: pfrBroj,
      datum_izdavanja: datumFakture,
      datum_dospijeca: datumDospijecaStr,
      projekti_ids: projekatIds,
    });
  } catch (err: any) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška pri kreiranju fakture" },
      { status: 500 },
    );
  } finally {
    conn.release();
  }
}
