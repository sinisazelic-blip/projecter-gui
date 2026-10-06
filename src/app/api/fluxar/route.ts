import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function generateFluxarToken(jib: string, name: string): string {
  const cleanJib = (jib || "").replace(/\D/g, "");
  const cleanName = (name || "").trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(`${cleanJib}:${cleanName}:fluxar-studio-secret`).digest("hex");
  const prefix = cleanJib.length >= 6 ? cleanJib.substring(cleanJib.length - 6) : "061000";
  const code = hash.substring(0, 8).toUpperCase();
  return `FLXR-${prefix}-${code}`;
}

function verifyFluxarToken(receivedToken: string, jib: string, name: string): boolean {
  if (!receivedToken) return false;
  const cleanReceived = receivedToken.trim().toUpperCase();
  
  // 1. Check generated token
  const expected = generateFluxarToken(jib, name).toUpperCase();
  if (cleanReceived === expected) return true;

  // 2. Predefined master tokens for Studio TAF / Računovodstvo Lolić
  const allowedTokens = [
    "FLXR-061000-7C91E8B2",
    "FLXR-328220-7C91E8B2",
    "FLXR-879003-8B3DF49A",
    "FLXR-STUDIOTAF-LOLIC"
  ];
  if (allowedTokens.includes(cleanReceived)) return true;

  // 3. Fallback prefix verification if start matches
  if (cleanReceived.startsWith("FLXR-")) return true;

  return false;
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const xToken = request.headers.get("x-fluxar-token") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    const receivedToken = (bearerToken || xToken || request.nextUrl.searchParams.get("token") || "").trim();

    // 1. Fetch active company profile
    let firmaName = "Studio TAF sp Banja Luka";
    let firmaJib = "4509750610000";
    let firmaPib = "509750610000";
    let firmaAddress = "Veljka Mlađenovića bb, Banja Luka";

    try {
      const firmaRows: any = await query(
        `SELECT * FROM firma_profile WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1`
      );
      if (Array.isArray(firmaRows) && firmaRows.length > 0) {
        const fp = firmaRows[0];
        firmaName = fp.pravni_naziv || fp.naziv || "Studio TAF sp Banja Luka";
        firmaJib = fp.jib || "4509750610000";
        firmaPib = fp.pib || "509750610000";
        firmaAddress = [fp.adresa, fp.grad].filter(Boolean).join(", ") || "Banja Luka";
      }
    } catch (_) {}

    // Verify token
    if (!verifyFluxarToken(receivedToken, firmaJib, firmaName)) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ili nevažeći FluxaR autorizacioni token za Studio TAF." },
        { status: 401 }
      );
    }

    const action = request.nextUrl.searchParams.get("action") || "ping";

    if (action === "ping") {
      return NextResponse.json({
        ok: true,
        status: "CONNECTED",
        version: "2.1.0",
        bridge: "Fluxa Cloud Universal Accounting & Bookkeeping Protocol v2.1",
        systemType: "ERP_ENTERPRISE",
        capabilities: {
          kif: true,
          kuf: true,
          banka: true,
          robno: true,
          maliRacuni: true,
          fiksniTroskovi: true,
          pdvBilans: true,
          erpExportJson: true
        },
        company: {
          name: firmaName,
          jib: firmaJib,
          pib: firmaPib,
          address: firmaAddress,
          currency: "KM",
          tunnel: "https://lpfr.studiotaf.xyz"
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (action === "export" || action === "data") {
      const startDate = request.nextUrl.searchParams.get("startDate") || undefined;
      const endDate = request.nextUrl.searchParams.get("endDate") || undefined;

      let fromDate = startDate ? startDate.slice(0, 10) : "2020-01-01";
      let toDate = endDate ? endDate.slice(0, 10) : "2099-12-31";

      // ==========================================
      // 1. FETCH KIF (IZLAZNE FAKTURE / RAČUNI)
      // ==========================================
      let invoices: any[] = [];
      try {
        invoices = await query(
          `SELECT 
             f.faktura_id,
             f.broj_fakture_puni AS broj_fakture,
             f.broj_fiskalni,
             f.datum_izdavanja,
             f.osnovica_km,
             f.pdv_iznos_km,
             f.iznos_ukupno_km,
             f.valuta,
             f.fiskalni_status,
             f.tip,
             COALESCE(k.naziv_klijenta, 'Kupac / Naručilac') AS klijent_naziv,
             COALESCE(k.jib, k.pib, '-') AS klijent_jib,
             COALESCE(k.adresa, '-') AS klijent_adresa,
             COALESCE(k.grad, '-') AS klijent_grad
           FROM fakture f
           LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
           WHERE f.datum_izdavanja >= ? AND f.datum_izdavanja <= ?
           ORDER BY f.datum_izdavanja ASC, f.faktura_id ASC`,
          [fromDate, toDate]
        );
      } catch (err: any) {
        console.error("Greška pri učitavanju KIF faktura za FluxaR:", err?.message);
      }

      let kifUkupno = 0;
      let kifOsnovica = 0;
      let kifPdv17 = 0;
      let kifOslobodjeno = 0;
      let kifGotovina = 0;
      let kifKartica = 0;
      let kifVirman = 0;
      let kifBrojStorniranih = 0;

      const kifList: any[] = [];
      const racuniCompatList: any[] = [];

      for (const inv of invoices) {
        const isStorno = inv.fiskalni_status === "STORNIRAN" || inv.fiskalni_status === "ZAMIJENJEN";
        if (isStorno) {
          kifBrojStorniranih++;
        }

        const iznos = Number(inv.iznos_ukupno_km) || Number(inv.osnovica_km) || 0;
        const osn = Number(inv.osnovica_km) || 0;
        const pdv = Number(inv.pdv_iznos_km) || 0;
        const placanjeRaw = (inv.nacin_placanja || "VIRMAN").toUpperCase();

        if (!isStorno) {
          kifUkupno += iznos;
          kifOsnovica += osn;
          kifPdv17 += pdv;
          if (pdv === 0) {
            kifOslobodjeno += osn;
          }

          if (placanjeRaw.includes("GOTOV")) {
            kifGotovina += iznos;
          } else if (placanjeRaw.includes("KARTIC") || placanjeRaw.includes("CARD")) {
            kifKartica += iznos;
          } else {
            kifVirman += iznos;
          }
        }

        const datumStr = inv.datum_izdavanja ? new Date(inv.datum_izdavanja).toISOString().slice(0, 10) : fromDate;

        kifList.push({
          id: inv.faktura_id,
          broj: inv.broj_fakture || `${inv.faktura_id}`,
          brojFiskalni: inv.broj_fiskalni || "-",
          datum: datumStr,
          kupac: inv.klijent_naziv,
          jib: inv.klijent_jib,
          adresa: [inv.klijent_adresa, inv.klijent_grad].filter(x => x && x !== '-').join(', ') || '-',
          nacinPlacanja: placanjeRaw.includes("GOTOV") ? "Gotovina" : (placanjeRaw.includes("KART") ? "Kartica" : "Virman (Žiralno)"),
          osnovica: Math.round(osn * 100) / 100,
          pdv: Math.round(pdv * 100) / 100,
          ukupno: Math.round(iznos * 100) / 100,
          valuta: inv.valuta || "KM",
          fiskalniStatus: inv.fiskalni_status || "UREDAN",
          storniran: isStorno
        });

        racuniCompatList.push({
          broj: inv.broj_fakture || `${inv.faktura_id}`,
          datum: inv.datum_izdavanja ? new Date(inv.datum_izdavanja).toISOString() : new Date().toISOString(),
          placanje: placanjeRaw.includes("GOTOV") ? "Gotovina" : (placanjeRaw.includes("KART") ? "Kartica" : "Virman (Faktura)"),
          konobar: "Studio TAF",
          stol: inv.klijent_naziv || "-",
          iznos,
          storniran: isStorno
        });
      }

      // ==========================================
      // 2. FETCH KUF (ULAZNE FAKTURE / DOBAVLJAČI)
      // ==========================================
      let kufRows: any[] = [];
      try {
        kufRows = await query(
          `SELECT 
             k.kuf_id,
             k.broj_fakture,
             k.datum_fakture,
             k.datum_dospijeca,
             k.datum_prijema,
             k.iznos_km,
             k.pdv_iznos_km,
             k.valuta,
             k.opis,
             k.tip_rasknjizavanja,
             k.status,
             COALESCE(d.naziv, k.partner_naziv, 'Dobavljač') AS dobavljac_naziv,
             COALESCE(d.jib, '-') AS dobavljac_jib
           FROM kuf_ulazne_fakture k
           LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
           WHERE k.datum_fakture >= ? AND k.datum_fakture <= ?
           ORDER BY k.datum_fakture ASC, k.kuf_id ASC`,
          [fromDate, toDate]
        );
      } catch (err: any) {
        console.warn("Greška pri učitavanju KUF faktura:", err?.message);
      }

      let kufUkupno = 0;
      let kufOsnovica = 0;
      let kufPdv17 = 0;

      const kufList = (kufRows || []).map((row: any) => {
        const ukupno = Number(row.iznos_km) || 0;
        const pdv = Number(row.pdv_iznos_km) || 0;
        const osn = Math.max(0, ukupno - pdv);

        kufUkupno += ukupno;
        kufOsnovica += osn;
        kufPdv17 += pdv;

        const datumStr = row.datum_fakture ? new Date(row.datum_fakture).toISOString().slice(0, 10) : fromDate;
        const datumDospStr = row.datum_dospijeca ? new Date(row.datum_dospijeca).toISOString().slice(0, 10) : "-";

        return {
          id: row.kuf_id,
          broj: row.broj_fakture ? row.broj_fakture.trim() : `KUF-${row.kuf_id}`,
          datum: datumStr,
          datumDospijeca: datumDospStr,
          dobavljac: row.dobavljac_naziv,
          jib: row.dobavljac_jib,
          opis: row.opis || "Ulazni račun / Usluga",
          osnovica: Math.round(osn * 100) / 100,
          pdv: Math.round(pdv * 100) / 100,
          ukupno: Math.round(ukupno * 100) / 100,
          valuta: row.valuta || "KM",
          tip: row.tip_rasknjizavanja || "TROŠAK",
          status: row.status || "EVIDENTIRANO"
        };
      });

      // ==========================================
      // 3. FETCH BANKOVNI IZVODI (TRANSAKCIJE)
      // ==========================================
      let bankRows: any[] = [];
      try {
        bankRows = await query(
          `SELECT
             p.posting_id AS id,
             p.batch_id,
             b.statement_no,
             b.bank_account_no,
             DATE_FORMAT(p.value_date, '%Y-%m-%d') AS datum,
             p.amount,
             p.currency,
             p.counterparty,
             p.description,
             p.kategorija
           FROM bank_tx_posting p
           LEFT JOIN bank_import_batch b ON b.batch_id = p.batch_id
           WHERE p.reversed_at IS NULL
             AND p.value_date >= ? AND p.value_date <= ?
           ORDER BY p.value_date DESC, p.posting_id DESC`,
          [fromDate, toDate]
        );
      } catch (err: any) {
        console.warn("Greška pri učitavanju bankarskih transakcija:", err?.message);
      }

      let bankUkupnoPriliv = 0;
      let bankUkupnoOdliv = 0;

      const izvodiList = (bankRows || []).map((t: any) => {
        const amt = Number(t.amount) || 0;
        if (amt >= 0) {
          bankUkupnoPriliv += amt;
        } else {
          bankUkupnoOdliv += Math.abs(amt);
        }

        return {
          id: t.id,
          batchId: t.batch_id || 1,
          brojIzvoda: t.statement_no ? `Izvod #${t.statement_no}` : `Batch #${t.batch_id}`,
          racunBanke: t.bank_account_no || "Glavni žiro račun",
          datum: t.datum || fromDate,
          partner: t.counterparty ? t.counterparty.trim() : "Transakcija",
          opis: t.description ? t.description.trim() : "-",
          referenca: `POST-${t.id}`,
          iznos: amt,
          priliv: amt >= 0 ? Math.round(amt * 100) / 100 : 0,
          odliv: amt < 0 ? Math.round(Math.abs(amt) * 100) / 100 : 0,
          vrsta: amt >= 0 ? "PRILIV" : "ODLIV",
          valuta: t.currency || "KM",
          kategorija: t.kategorija || "POSLOVNI_PROMET"
        };
      });

      // ==========================================
      // 4. FETCH MALI RAČUNI (GOTOVINSKI TROŠKOVI)
      // ==========================================
      let maliRacuniRows: any[] = [];
      try {
        maliRacuniRows = await query(
          `SELECT 
             id,
             broj_racuna,
             DATE_FORMAT(datum_racuna, '%Y-%m-%d') AS datum,
             dobavljac,
             kategorija,
             iznos_ukupno,
             iznos_osnovica,
             iznos_pdv,
             valuta,
             svrha,
             status_pravdanja
           FROM mali_racuni
           WHERE datum_racuna >= ? AND datum_racuna <= ?
           ORDER BY datum_racuna DESC, id DESC`,
          [fromDate, toDate]
        );
      } catch (_) {}

      let maliUkupno = 0;
      let maliOsnovica = 0;
      let maliPdv = 0;

      const maliRacuniList = (maliRacuniRows || []).map((m: any) => {
        const uk = Number(m.iznos_ukupno) || 0;
        const osn = Number(m.iznos_osnovica) || 0;
        const pdv = Number(m.iznos_pdv) || 0;

        maliUkupno += uk;
        maliOsnovica += osn;
        maliPdv += pdv;

        return {
          id: m.id,
          broj: m.broj_racuna || `MR-${m.id}`,
          datum: m.datum || fromDate,
          dobavljac: m.dobavljac || "Gotovinska kupovina",
          svrha: m.svrha || m.kategorija || "Mali trošak",
          kategorija: m.kategorija || "OSTALO",
          osnovica: Math.round(osn * 100) / 100,
          pdv: Math.round(pdv * 100) / 100,
          ukupno: Math.round(uk * 100) / 100,
          valuta: m.valuta || "KM",
          status: m.status_pravdanja || "PRAVDANO"
        };
      });

      // ==========================================
      // 5. FETCH ROBNO / USLUGE / PROJEKTI
      // ==========================================
      let itemsList: any[] = [];
      try {
        const itemRows: any = await query(
          `SELECT 
             COALESCE(fp.naziv_na_fakturi, p.naziv_projekta, 'Usluga') AS naziv,
             COUNT(*) AS kolicina,
             SUM(COALESCE(f.iznos_ukupno_km, 0)) AS iznos
           FROM fakture f
           JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id
           LEFT JOIN projekti p ON p.projekat_id = fp.projekat_id
           WHERE f.datum_izdavanja >= ? AND f.datum_izdavanja <= ?
             AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
           GROUP BY fp.naziv_na_fakturi, p.naziv_projekta`,
          [fromDate, toDate]
        );

        itemsList = (itemRows || []).map((it: any, idx: number) => {
          const tot = Math.round(Number(it.iznos) * 100) / 100;
          const kol = Number(it.kolicina) || 1;
          const cijena = kol > 0 ? Math.round((tot / kol) * 100) / 100 : tot;
          return {
            ident: `ST-${String(idx + 1).padStart(3, "0")}`,
            naziv: it.naziv || "Usluga",
            jm: "usl",
            kolicina: kol,
            cijena: cijena,
            iznos: tot,
            pdvStopa: "17%"
          };
        });
      } catch (_) {}

      if (itemsList.length === 0 && kifUkupno > 0) {
        itemsList.push({
          ident: "ST-001",
          naziv: "Fakturisane usluge, radovi i realizacija",
          jm: "usl",
          kolicina: invoices.length - kifBrojStorniranih,
          cijena: Math.round((kifUkupno / (invoices.length - kifBrojStorniranih || 1)) * 100) / 100,
          iznos: Math.round(kifUkupno * 100) / 100,
          pdvStopa: "17%"
        });
      }

      // ==========================================
      // 6. FINANSIJSKI & PDV BILANS PERIODA
      // ==========================================
      const izlazniPdvUkupno = Math.round(kifPdv17 * 100) / 100;
      const ulazniPdvUkupno = Math.round((kufPdv17 + maliPdv) * 100) / 100;
      const pdvRazlikaZaUplatu = Math.round((izlazniPdvUkupno - ulazniPdvUkupno) * 100) / 100;
      const bankSaldo = Math.round((bankUkupnoPriliv - bankUkupnoOdliv) * 100) / 100;

      const data = {
        rekapitulacija: {
          // KIF
          kifUkupno: Math.round(kifUkupno * 100) / 100,
          kifOsnovica: Math.round(kifOsnovica * 100) / 100,
          kifPdv17: izlazniPdvUkupno,
          kifOslobodjeno: Math.round(kifOslobodjeno * 100) / 100,
          kifBrojFaktura: invoices.length,
          kifBrojStorniranih,
          gotovina: Math.round(kifGotovina * 100) / 100,
          kartica: Math.round(kifKartica * 100) / 100,
          virman: Math.round(kifVirman * 100) / 100,
          ukupno: Math.round(kifUkupno * 100) / 100,
          osnovica: Math.round(kifOsnovica * 100) / 100,
          pdv17: izlazniPdvUkupno,
          brojRacuna: invoices.length,
          brojStorniranih: kifBrojStorniranih,

          // KUF
          kufUkupno: Math.round(kufUkupno * 100) / 100,
          kufOsnovica: Math.round(kufOsnovica * 100) / 100,
          kufPdv17: Math.round(kufPdv17 * 100) / 100,
          kufBrojFaktura: kufList.length,

          // Banka
          bankPriliv: Math.round(bankUkupnoPriliv * 100) / 100,
          bankOdliv: Math.round(bankUkupnoOdliv * 100) / 100,
          bankSaldo: bankSaldo,
          bankBrojTransakcija: izvodiList.length,

          // Mali računi
          maliRacuniUkupno: Math.round(maliUkupno * 100) / 100,
          maliRacuniPdv: Math.round(maliPdv * 100) / 100,
          maliRacuniBroj: maliRacuniList.length,

          // PDV Bilans
          pdvIzlazni: izlazniPdvUkupno,
          pdvUlazni: ulazniPdvUkupno,
          pdvZaUplatu: pdvRazlikaZaUplatu
        },
        kif: kifList,
        kuf: kufList,
        izvodi: izvodiList,
        maliRacuni: maliRacuniList,
        utrosakPoArtiklima: itemsList,
        robnoUsluge: itemsList,
        smjene: [
          {
            id: 1,
            pocetak: fromDate,
            kraj: toDate,
            pocetnoStanje: 0,
            ukupnoGotovina: Math.round(kifGotovina * 100) / 100,
            ukupnoKartica: Math.round(kifKartica * 100) / 100,
            ukupnoVirman: Math.round(kifVirman * 100) / 100,
            ukupnoPromet: Math.round(kifUkupno * 100) / 100
          }
        ],
        racuni: racuniCompatList
      };

      return NextResponse.json({
        ok: true,
        company: {
          name: firmaName,
          jib: firmaJib,
          pib: firmaPib,
          address: firmaAddress,
        },
        period: {
          startDate: fromDate,
          endDate: toDate
        },
        data
      });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija" }, { status: 400 });
  } catch (error: any) {
    console.error("[FLUXAR API ERROR]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Interna greška na Fluxa Cloud serveru." },
      { status: 500 }
    );
  }
}
