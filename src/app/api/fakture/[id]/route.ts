// src/app/api/fakture/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { assertOwner } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

/** Vraća datum kao YYYY-MM-DD da izbjegnemo timezone pomak pri JSON serijalizaciji (MySQL DATE → JS Date → UTC može dati dan ranije). */
function toDateOnlyString(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  if (val instanceof Date) {
    const y = val.getFullYear(),
      m = val.getMonth() + 1,
      d = val.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/**
 * DELETE — owner-only brisanje POSLJEDNJE fakture.
 * Oslobađa broj fakture (broj_u_godini + brojac_faktura) i PFR (MAX broj_fiskalni).
 * Dozvoljeno samo ako je faktura zadnja u svojoj godini i (ako ima PFR) zadnji PFR —
 * brisanje iz sredine niza pravilo bi trajnu rupu u numeraciji (za to postoji storno).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOwner(req);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message === "OWNER_ONLY" ? "OWNER_ONLY" : "OWNER_NOT_CONFIGURED" },
      { status: e?.status ?? 503 },
    );
  }

  const p = await params;
  const fakturaId = Number(p.id);
  if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
    return NextResponse.json({ ok: false, error: "Neispravan ID fakture" }, { status: 400 });
  }

  const conn = await (pool as any).getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query(
      `SELECT faktura_id, godina, broj_u_godini, broj_fiskalni, osnovica_km, fiskalni_status
       FROM fakture WHERE faktura_id = ? LIMIT 1 FOR UPDATE`,
      [fakturaId],
    );
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Faktura nije pronađena." }, { status: 404 });
    }
    const f = rows[0];
    const godina = Number(f.godina);
    const brojUGodini = Number(f.broj_u_godini);
    const pfr = f.broj_fiskalni != null ? Number(f.broj_fiskalni) : null;
    const isStorno = Number(f.osnovica_km ?? 0) < 0;

    const status = String(f.fiskalni_status ?? "").trim().toUpperCase();
    if (status === "PLACENA") {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Plaćena faktura se ne može obrisati." },
        { status: 409 },
      );
    }

    // Mora biti posljednja u godini
    const [maxRows]: any = await conn.query(
      `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?`,
      [godina],
    );
    const maxBroj = Number(maxRows?.[0]?.m ?? 0) || 0;
    if (brojUGodini !== maxBroj) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error: "NOT_LAST_INVOICE",
          message: `Može se obrisati samo posljednja faktura u godini (posljednja je ${String(maxBroj).padStart(3, "0")}/${godina}). Za ranije fakture koristi storno.`,
        },
        { status: 409 },
      );
    }

    // Ako ima PFR — mora biti i posljednji PFR
    if (pfr != null && pfr > 0) {
      const [pfrRows]: any = await conn.query(
        `SELECT COALESCE(MAX(broj_fiskalni), 0) AS m FROM fakture WHERE broj_fiskalni IS NOT NULL AND broj_fiskalni > 0`,
      );
      const maxPfr = Number(pfrRows?.[0]?.m ?? 0) || 0;
      if (pfr !== maxPfr) {
        await conn.rollback();
        return NextResponse.json(
          {
            ok: false,
            error: "NOT_LAST_PFR",
            message: `Može se obrisati samo faktura sa posljednjim PFR brojem (posljednji je ${maxPfr}).`,
          },
          { status: 409 },
        );
      }
    }

    // Projekti vezani za fakturu (za vraćanje statusa)
    const [fpRows]: any = await conn.query(
      `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ?`,
      [fakturaId],
    );
    const projekatIds: number[] = (fpRows ?? [])
      .map((r: any) => Number(r.projekat_id))
      .filter(Number.isFinite);

    await conn.query(`DELETE FROM faktura_projekti WHERE faktura_id = ?`, [fakturaId]);
    await conn.query(`DELETE FROM fakture WHERE faktura_id = ?`, [fakturaId]);

    // Oslobodi broj u brojaču (sljedeća faktura ponovo dobija ovaj broj)
    try {
      await conn.query(
        `UPDATE brojac_faktura SET zadnji_broj_u_godini = ? WHERE godina = ? AND zadnji_broj_u_godini >= ?`,
        [brojUGodini - 1, godina, brojUGodini],
      );
    } catch {
      // brojac_faktura ne postoji — MAX iz fakture je dovoljan
    }

    // Obična faktura: projekti se vraćaju iz Fakturisan (9) u Zatvoren (8).
    // Storno: projekti su već vraćeni u 8 pri storniranju — ne diramo.
    if (!isStorno && projekatIds.length > 0) {
      await conn.query(
        `UPDATE projekti SET status_id = 8 WHERE projekat_id IN (${projekatIds.map(() => "?").join(",")}) AND status_id = 9`,
        projekatIds,
      );
    }

    for (const pid of projekatIds) {
      try {
        await conn.query(
          `INSERT INTO project_audit (projekat_id, action, details, user_label, ip)
           VALUES (?, 'FAKTURA_DELETED', ?, 'OWNER', '127.0.0.1')`,
          [
            pid,
            JSON.stringify({
              faktura_id: fakturaId,
              broj: `${String(brojUGodini).padStart(3, "0")}/${godina}`,
              pfr,
              storno: isStorno,
            }),
          ],
        );
      } catch {
        // audit je best-effort
      }
    }

    await conn.commit();

    return NextResponse.json({
      ok: true,
      message: `Faktura ${String(brojUGodini).padStart(3, "0")}/${godina} obrisana. Broj${pfr ? " i PFR " + pfr : ""} su oslobođeni za sljedeću fakturu.`,
      oslobodjen_broj: `${String(brojUGodini).padStart(3, "0")}/${godina}`,
      oslobodjen_pfr: pfr,
      projekti_ids: projekatIds,
    });
  } catch (err: any) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Greška pri brisanju fakture" },
      { status: 500 },
    );
  } finally {
    conn.release();
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const fakturaId = Number(p.id);

  try {
    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ID fakture" },
        { status: 400 },
      );
    }

    // Učitaj fakturu
    let fakturaRows: any = [];
    try {
      fakturaRows = await query(
        `
        SELECT
          f.faktura_id,
          f.broj_fakture_puni AS broj_fakture,
          f.broj_fiskalni,
          f.datum_izdavanja,
          f.bill_to_klijent_id AS narucilac_id,
          k.naziv_klijenta AS narucilac_naziv,
          k.rok_placanja_dana,
          f.osnovica_km AS iznos_bez_pdv,
          f.pdv_iznos_km AS pdv_iznos,
          f.iznos_ukupno_km AS iznos_sa_pdv,
          f.valuta,
          f.fiskalni_status AS status,
          f.tip,
          f.poziv_na_broj,
          f.created_at
        FROM fakture f
        LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
        WHERE f.faktura_id = ?
        LIMIT 1
        `,
        [fakturaId],
      );
    } catch (queryErr: any) {
      console.error(`❌ Greška pri učitavanju fakture ${fakturaId}:`, queryErr?.message);
      console.error(`   Stack:`, queryErr?.stack);
      throw new Error(`Greška pri učitavanju fakture: ${queryErr?.message}`);
    }

    if (!fakturaRows || fakturaRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faktura nije pronađena" },
        { status: 404 },
      );
    }

    const faktura = fakturaRows[0];

    // Datum izdavanja: uvijek kao YYYY-MM-DD (bez vremena) da klijent vidi isti dan kao u wizardu
    const datumIzdavanjaStr = toDateOnlyString(faktura.datum_izdavanja);
    faktura.datum_izdavanja = datumIzdavanjaStr;

    // Formatiraj broj fakture ako je potrebno (npr. "6/2026" -> "006/2026")
    let brojFaktureFormatiran = faktura.broj_fakture;
    if (faktura.broj_fakture && typeof faktura.broj_fakture === "string") {
      const parts = faktura.broj_fakture.split("/");
      if (parts.length === 2) {
        const broj = parts[0];
        const godina = parts[1];
        if (/^\d+$/.test(broj) && /^\d{4}$/.test(godina)) {
          brojFaktureFormatiran = `${String(Number(broj)).padStart(3, "0")}/${godina}`;
        }
      }
    }

    // Izračunaj datum dospijeća (datum_izdavanja + rok_placanja_dana) — koristi noon da izbjegnemo DST/timezone
    let datumDospijeca: string | null = null;
    if (datumIzdavanjaStr && faktura.rok_placanja_dana) {
      const datum = new Date(datumIzdavanjaStr + "T12:00:00");
      datum.setDate(datum.getDate() + Number(faktura.rok_placanja_dana));
      datumDospijeca = datum.toISOString().slice(0, 10);
    }

    // Učitaj projekte vezane za fakturu
    let projektiIds: number[] = [];
    
    // Učitaj projekte, opisne stavke i naziv_na_fakturi iz faktura_projekti
    let projectSubItems: Record<number, string[]> = {};
    let projectNames: Record<number, string> = {};
    try {
      const projektiRows: any = await query(
        `SELECT projekat_id, opisne_stavke, naziv_na_fakturi FROM faktura_projekti WHERE faktura_id = ?`,
        [fakturaId],
      );
      if (Array.isArray(projektiRows) && projektiRows.length > 0) {
        projektiIds = projektiRows
          .map((r: any) => Number(r.projekat_id))
          .filter(Number.isFinite);
        for (const r of projektiRows) {
          const pid = Number(r.projekat_id);
          if (!Number.isFinite(pid)) continue;
          let items: string[] = [];
          try {
            if (r.opisne_stavke) {
              const parsed = typeof r.opisne_stavke === "string"
                ? JSON.parse(r.opisne_stavke)
                : r.opisne_stavke;
              items = Array.isArray(parsed)
                ? parsed.map((s: any) => String(s ?? "").trim()).filter(Boolean)
                : [];
            }
          } catch (_) {}
          if (items.length > 0) projectSubItems[pid] = items;
          if (r.naziv_na_fakturi && String(r.naziv_na_fakturi).trim()) {
            projectNames[pid] = String(r.naziv_na_fakturi).trim();
          }
        }
        console.log(`✅ Pronađeno ${projektiIds.length} projekata iz faktura_projekti za fakturu ${fakturaId}`);
      }
    } catch (err: any) {
      // Ako opisne_stavke ili naziv_na_fakturi kolona ne postoji, pokušaj bez njih
      const errMsg = String(err?.message || "").toLowerCase();
      if (errMsg.includes("unknown column")) {
        try {
          const projektiRowsFallback: any = await query(
            `SELECT projekat_id, opisne_stavke FROM faktura_projekti WHERE faktura_id = ?`,
            [fakturaId],
          );
          if (Array.isArray(projektiRowsFallback) && projektiRowsFallback.length > 0) {
            projektiIds = projektiRowsFallback
              .map((r: any) => Number(r.projekat_id))
              .filter(Number.isFinite);
            for (const r of projektiRowsFallback) {
              const pid = Number(r.projekat_id);
              if (!Number.isFinite(pid) || !r.opisne_stavke) continue;
              try {
                const parsed = typeof r.opisne_stavke === "string" ? JSON.parse(r.opisne_stavke) : r.opisne_stavke;
                const items = Array.isArray(parsed) ? parsed.map((s: any) => String(s ?? "").trim()).filter(Boolean) : [];
                if (items.length > 0) projectSubItems[pid] = items;
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      if (projektiIds.length === 0) {
        console.warn(`⚠️ Greška pri učitavanju iz faktura_projekti za fakturu ${fakturaId}:`, err?.message);
      }
    }

    // Fallback: ako nema veza u faktura_projekti, pokušaj da nađeš preko project_audit
    if (projektiIds.length === 0) {
      console.log(`🔍 Pokušavam fallback: učitavanje projekata iz project_audit za fakturu ${fakturaId}`);
      try {
        // Prvo pokušaj sa JSON_EXTRACT (ako je details JSON kolona)
        let auditRows: any = [];
        try {
          auditRows = await query(
            `
            SELECT DISTINCT projekat_id
            FROM project_audit
            WHERE action = 'PROJECT_INVOICED'
            AND CAST(JSON_EXTRACT(details, '$.faktura_id') AS UNSIGNED) = ?
            `,
            [fakturaId],
          );
        } catch (jsonErr: any) {
          // Ako JSON_EXTRACT ne radi, pokušaj sa LIKE pretragom (ako je details TEXT)
          console.log(`   JSON_EXTRACT ne radi, pokušavam sa LIKE pretragom`);
          auditRows = await query(
            `
            SELECT DISTINCT projekat_id
            FROM project_audit
            WHERE action = 'PROJECT_INVOICED'
            AND details LIKE ?
            `,
            [`%"faktura_id":${fakturaId}%`],
          );
        }
        
        console.log(`   Pronađeno ${Array.isArray(auditRows) ? auditRows.length : 0} audit zapisa`);
        
        if (Array.isArray(auditRows) && auditRows.length > 0) {
          projektiIds = auditRows
            .map((r: any) => Number(r.projekat_id))
            .filter(Number.isFinite)
            .filter((id, index, self) => self.indexOf(id) === index); // ukloni duplikate
          console.log(`✅ Pronađeno ${projektiIds.length} projekata iz audit loga za fakturu ${fakturaId}: ${projektiIds.join(", ")}`);
        } else {
          console.warn(`⚠️ Nema audit zapisa za fakturu ${fakturaId}`);
        }
      } catch (err: any) {
        // Ako ni audit log ne radi, ignorišemo
        console.error(`❌ Greška pri učitavanju projekata iz audit loga za fakturu ${fakturaId}:`, err?.message);
        console.error(`   Stack:`, err?.stack);
      }
    }
    
    if (projektiIds.length === 0) {
      console.warn(`⚠️ Faktura ${fakturaId} nema povezanih projekata ni iz faktura_projekti ni iz audit loga`);
    }

    return NextResponse.json({
      ok: true,
      faktura: {
        ...faktura,
        broj_fakture: brojFaktureFormatiran,
        datum_dospijeca: datumDospijeca,
        projekti_ids: projektiIds,
        project_sub_items: projectSubItems,
        project_names: projectNames,
      },
    });
  } catch (err: any) {
    console.error(`❌ Greška u API /api/fakture/${fakturaId}:`, err?.message);
    console.error(`   Stack:`, err?.stack);
    return NextResponse.json(
      { 
        ok: false, 
        error: err?.message ?? "Greška na serveru",
        debug: process.env.NODE_ENV === 'development' ? {
          message: err?.message,
          stack: err?.stack,
          fakturaId,
        } : undefined,
      },
      { status: 500 },
    );
  }
}
