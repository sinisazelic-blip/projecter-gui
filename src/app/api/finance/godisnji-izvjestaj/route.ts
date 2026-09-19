import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { includeStudioArchive } from "@/lib/reports/archive";

const ARHIVA_CUTOFF = "2025-12-31";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const targetYear = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const licniOdbitakParam = url.searchParams.get("licni_odbitak");
    const licniOdbitakKm = licniOdbitakParam ? Number(licniOdbitakParam) : 12000.00;

    const fromDate = `${targetYear}-01-01`;
    const toDate = `${targetYear}-12-31`;

    // 1. Prihodi (KIF - izlazne fakture bez PDV-a)
    let prihodiUkupnoKm = 0;
    let pdvIzlazniUkupnoKm = 0;
    let faktureBroj = 0;

    try {
      const kifRows = await query<any>(
        `SELECT 
           COUNT(*) AS cnt,
           SUM(CASE WHEN UPPER(TRIM(COALESCE(valuta, 'BAM'))) = 'EUR' THEN COALESCE(osnovica_km, 0) * 1.95583 ELSE COALESCE(osnovica_km, 0) END) AS ukupno_osnovica,
           SUM(CASE WHEN UPPER(TRIM(COALESCE(valuta, 'BAM'))) = 'EUR' THEN 0 ELSE COALESCE(pdv_iznos_km, 0) END) AS ukupno_pdv
         FROM fakture
         WHERE datum_izdavanja >= ? AND datum_izdavanja <= ?
           AND (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))`,
        [fromDate, toDate]
      );
      if (kifRows?.[0]) {
        prihodiUkupnoKm += Number(kifRows[0].ukupno_osnovica) || 0;
        pdvIzlazniUkupnoKm += Number(kifRows[0].ukupno_pdv) || 0;
        faktureBroj += Number(kifRows[0].cnt) || 0;
      }
    } catch {}

    if (includeStudioArchive()) {
      try {
        const archRows = await query<any>(
          `SELECT 
             COUNT(DISTINCT broj_fakture) AS cnt,
             SUM(COALESCE(iznos_km, 0)) AS ukupno_osnovica
           FROM stg_master_finansije
           WHERE datum_fakture IS NOT NULL AND datum_fakture <= ?
             AND datum_fakture >= ? AND datum_fakture <= ?`,
          [ARHIVA_CUTOFF, fromDate, toDate]
        );
        if (archRows?.[0]) {
          prihodiUkupnoKm += Number(archRows[0].ukupno_osnovica) || 0;
          faktureBroj += Number(archRows[0].cnt) || 0;
        }
      } catch {}
    }

    // 2. Rashodi poslovanja (KUF)
    let nematerijalniTroskoviKm = 0; // Knjigovodstvo, licence, komunalije, pretplate
    let proizvodneUslugeKm = 0;      // PTT, kuriri, vanjski rad
    let gorivoEnergijaKm = 0;        // Gorivo, struja
    let servisiOdrzavanjeKm = 0;
    let ostaliRashodiKm = 0;

    try {
      const kufRows = await query<any>(
        `SELECT 
           k.tip_rasknjizavanja,
           k.vanredni_podtip,
           k.opis,
           k.partner_naziv,
           d.naziv AS dobavljac_naziv,
           SUM(COALESCE(k.iznos_km, k.iznos)) AS ukupno_km
         FROM kuf_ulazne_fakture k
         LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
         WHERE (k.datum_fakture >= ? AND k.datum_fakture <= ?)
           AND (k.status IS NULL OR k.status NOT IN ('STORNO'))
         GROUP BY k.kuf_id`,
        [fromDate, toDate]
      );

      for (const r of kufRows || []) {
        const iznos = Number(r.ukupno_km) || 0;
        const tip = r.tip_rasknjizavanja || "";
        const podtip = r.vanredni_podtip || "";
        const opis = (r.opis || "").toLowerCase();
        const partner = (r.dobavljac_naziv || r.partner_naziv || "").toLowerCase();

        if (opis.includes("goriv") || opis.includes("benzin") || partner.includes("petrol") || partner.includes("nestro")) {
          gorivoEnergijaKm += iznos;
        } else if (opis.includes("ptt") || opis.includes("pošt") || opis.includes("post") || partner.includes("dhl") || partner.includes("posta")) {
          proizvodneUslugeKm += iznos;
        } else if (podtip === "SERVIS" || opis.includes("servis")) {
          servisiOdrzavanjeKm += iznos;
        } else if (tip === "FIKSNI_TROSAK" || opis.includes("knjigov") || opis.includes("licenc") || opis.includes("cloud") || opis.includes("host")) {
          nematerijalniTroskoviKm += iznos;
        } else {
          ostaliRashodiKm += iznos;
        }
      }
    } catch {}

    // 3. Finansijski rashodi (Bankarske provizije iz izvoda)
    let finansijskiRashodiKm = 0;
    try {
      const provizije = await query<any>(
        `SELECT 
           SUM(COALESCE(provizija, 0)) AS provizije
         FROM banka_izvodi_stavke
         WHERE datum >= ? AND datum <= ?`,
        [fromDate, toDate]
      );
      finansijskiRashodiKm = Number(provizije?.[0]?.provizije) || 0;
    } catch {}

    // 4. Amortizacija osnovnih sredstava
    let amortizacijaUkupnoKm = 0;
    let osnovnaSredstvaStavke: any[] = [];
    try {
      const osRows = await query<any>(
        `SELECT * FROM osnovna_sredstva WHERE status = 'U_UPOTREBI'`
      );
      for (const r of osRows || []) {
        const nabavna = Number(r.nabavna_vrijednost_km) || 0;
        const stopa = Number(r.stopa_amortizacije) || 20;
        const godisnjiOtpis = Math.round((nabavna * (stopa / 100)) * 100) / 100;
        const nabavkaYear = r.datum_nabavke ? new Date(r.datum_nabavke).getFullYear() : targetYear;
        
        if (nabavkaYear <= targetYear) {
          amortizacijaUkupnoKm += godisnjiOtpis;
          osnovnaSredstvaStavke.push({
            naziv: r.naziv,
            kategorija: r.kategorija,
            nabavna_vrijednost_km: nabavna,
            stopa: stopa,
            amortizacija_km: godisnjiOtpis,
          });
        }
      }
    } catch {}

    // Zbir priznatih rashoda za Obrazac 1006 Tabela 8
    const priznatiRashodiUkupnoKm = Math.round(
      (nematerijalniTroskoviKm + proizvodneUslugeKm + gorivoEnergijaKm + servisiOdrzavanjeKm + ostaliRashodiKm + finansijskiRashodiKm + amortizacijaUkupnoKm) * 100
    ) / 100;

    // Dohodak = Prihodi - Rashodi
    const dohodakKm = Math.round((prihodiUkupnoKm - priznatiRashodiUkupnoKm) * 100) / 100;

    // Poreska osnovica = max(0, Dohodak - Lični odbitak)
    const poreskaOsnovicaKm = Math.max(0, Math.round((dohodakKm - licniOdbitakKm) * 100) / 100);

    // Porez na dohodak (10%)
    const porezNaDohodakKm = Math.round((poreskaOsnovicaKm * 0.10) * 100) / 100;

    return NextResponse.json({
      ok: true,
      year: targetYear,
      obveznik: {
        naziv: '"Studio TAF" - Zelić Siniša s.p. Banja Luka',
        vlasnik: "Siniša Zelić",
        jib: "4509750610000",
        jmbg: "1408964100023",
        opstina_sifra: "002",
        opstina_naziv: "Banja Luka",
        djelatnost: "Usluge zvučnog snimanja, emitovanja i mjerenja",
      },
      kalkulacija: {
        prihodi_ukupno_km: Math.round(prihodiUkupnoKm * 100) / 100,
        fakture_broj: faktureBroj,
        rashodi_ukupno_km: priznatiRashodiUkupnoKm,
        dohodak_km: dohodakKm,
        licni_odbitak_km: licniOdbitakKm,
        poreska_osnovica_km: poreskaOsnovicaKm,
        porez_stopa_procenat: 10,
        porez_na_dohodak_km: porezNaDohodakKm,
      },
      obrazac_1006_tabela_8: {
        red_1_zarade: 0.00,
        red_2_proizvodne_usluge_ptt: Math.round(proizvodneUslugeKm * 100) / 100,
        red_3_gorivo_energija: Math.round(gorivoEnergijaKm * 100) / 100,
        red_4_nematerijalni_troskovi: Math.round(nematerijalniTroskoviKm * 100) / 100,
        red_5_finansijski_rashodi: Math.round(finansijskiRashodiKm * 100) / 100,
        red_6_ostali_rashodi: Math.round((ostaliRashodiKm + servisiOdrzavanjeKm) * 100) / 100,
        red_8_amortizacija: Math.round(amortizacijaUkupnoKm * 100) / 100,
        red_17_ukupan_iznos: priznatiRashodiUkupnoKm,
      },
      osnovna_sredstva_detalji: osnovnaSredstvaStavke,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
