import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      zaFakturisanjeRows,
      potrazivanjaRows,
      aktivniProjektiRows,
      dealsRows,
      racuniRows,
      tenantsRows,
      meetsRows,
      trendRows,
      pdvRows
    ] = await Promise.all([
      // 1. SPREMNO ZA FAKTURISANJE (Projekti sa status_id = 8, non pro-bono)
      query(`
        SELECT 
          p.projekat_id,
          p.radni_naziv,
          k.naziv_klijenta,
          k.drzava,
          vf.budzet_planirani,
          CASE
            WHEN COALESCE(k.drzava,'') <> 'BiH' THEN vf.budzet_planirani
            WHEN vf.budzet_planirani IS NULL THEN NULL
            ELSE ROUND(vf.budzet_planirani * 1.17, 2)
          END AS sa_pdv_km
        FROM projekti p
        LEFT JOIN klijenti k ON p.narucilac_id = k.klijent_id
        LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
        WHERE p.status_id = 8 AND COALESCE(p.pro_bono, 0) = 0
        ORDER BY p.projekat_id DESC
      `),

      // 2. OTVORENA POTRAŽIVANJA (Fakture koje nisu plaćene, niti stornirane)
      query(`
        SELECT 
          f.faktura_id,
          COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS broj_fakture,
          DATE_FORMAT(f.datum_izdavanja, '%Y-%m-%d') AS datum_izdavanja,
          DATE_FORMAT(DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(k.rok_placanja_dana, 30) DAY), '%Y-%m-%d') AS datum_valute,
          COALESCE(k.rok_placanja_dana, 30) AS rok_placanja_dana,
          DATEDIFF(CURDATE(), DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(k.rok_placanja_dana, 30) DAY)) AS dana_kasnjenja,
          f.iznos_ukupno_km,
          f.valuta,
          f.fiskalni_status,
          k.naziv_klijenta,
          CASE 
            WHEN f.valuta = 'EUR' THEN ROUND(f.iznos_ukupno_km * 1.95583, 2)
            ELSE f.iznos_ukupno_km
          END as iznos_km
        FROM fakture f
        LEFT JOIN klijenti k ON f.bill_to_klijent_id = k.klijent_id
        WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA', 'PAID', 'STORNIRAN', 'ZAMIJENJEN'))
        ORDER BY f.datum_izdavanja ASC
      `),

      // 3. AKTIVNI PROJEKTI U TOKU (statusi != 8, 9, 10, 11, 12)
      query(`
        SELECT 
          p.projekat_id,
          p.radni_naziv,
          COALESCE(k.naziv_klijenta, 'Klijent') as klijent_naziv,
          COALESCE(vf.budzet_planirani, 0) as budzet,
          p.status_id,
          DATE_FORMAT(p.rok_glavni, '%Y-%m-%d') as rok_datum,
          DATE_FORMAT(p.rok_glavni, '%H:%i') as rok_vrijeme,
          DATE_FORMAT(p.created_at, '%Y-%m-%d') as datum_otvaranja,
          DATE_FORMAT(p.created_at, '%H:%i') as vrijeme_otvaranja,
          DATEDIFF(p.rok_glavni, CURDATE()) as dana_do_roka
        FROM projekti p
        LEFT JOIN klijenti k ON p.narucilac_id = k.klijent_id
        LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
        WHERE p.status_id NOT IN (8, 9, 10, 11, 12)
        ORDER BY p.projekat_id DESC
      `),

      // 4. DEALS & INICIJACIJE (tabela inicijacije)
      query(`
        SELECT 
          COUNT(*) as broj,
          COALESCE(SUM(procijenjeni_iznos), 0) as budzet
        FROM inicijacije
        WHERE COALESCE(arhivirano, 0) = 0 AND projekat_id IS NULL
      `),

      // 5. STANJA RAČUNA I GOTOVINE
      query(`
        SELECT 
          id, naziv, opis, tip, saldo, valuta, updated_at
        FROM owner_racuni_stanja
        ORDER BY sort_order ASC, id ASC
      `),

      // 6. MASTER HUB LICENCE (tabela tenants)
      query(`
        SELECT 
          COUNT(*) as ukupno_licenci,
          SUM(CASE WHEN status IN ('AKTIVAN', 'PILOT') THEN 1 ELSE 0 END) as aktivne_licence
        FROM tenants
      `),

      // 7. PRESTOJEĆA PLIVAČKA TAKMIČENJA (SWISS TIMING)
      query(`
        SELECT 
          kalendar_id as meet_id,
          naziv_takmicenja as naziv,
          COALESCE(lokacija_grad, bazen_naziv) as lokacija,
          DATE_FORMAT(datum_od, '%Y-%m-%d') AS datum_od,
          DATE_FORMAT(datum_do, '%Y-%m-%d') AS datum_do,
          broj_takmicarskih_dana,
          status,
          ugovoreni_pausal_km
        FROM plivacki_kalendar
        WHERE (godina = 2026 OR datum_do >= CURDATE())
          AND (status IS NULL OR status NOT IN ('NAPLACENO', 'PLACENO', 'ZAVRSENO', 'OTKAZANO'))
        ORDER BY datum_od ASC
      `),

      // 8. 6-MJESEČNI TREND FAKTURISANJA I NAPLATE
      query(`
        SELECT 
          DATE_FORMAT(datum_izdavanja, '%m/%Y') as label,
          ROUND(COALESCE(SUM(iznos_ukupno_km), 0), 2) as fakturisano,
          ROUND(COALESCE(SUM(CASE WHEN fiskalni_status IN ('PLACENA', 'PAID') THEN iznos_ukupno_km ELSE 0 END), 0), 2) as placeno
        FROM fakture
        WHERE datum_izdavanja >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(datum_izdavanja, '%m/%Y'), DATE_FORMAT(datum_izdavanja, '%Y-%m')
        ORDER BY DATE_FORMAT(datum_izdavanja, '%Y-%m') ASC
      `),

      // 9. EVIDENTIRANA PDV PLAĆANJA IZ IZVODA
      query(`
        SELECT DISTINCT DATE_FORMAT(value_date, '%Y-%m') AS ym
        FROM bank_tx_posting
        WHERE reversed_at IS NULL
          AND (kategorija = 'pdv' OR counterparty LIKE '%INDIREKTN%' OR description LIKE '%INDIREKTNI POREZ%')
          AND amount < -5
      `)
    ]);

    // Obrada za fakturisanje
    const zaFakturisanjeList = Array.isArray(zaFakturisanjeRows) ? zaFakturisanjeRows : [];
    const zaFakturisanjeIznos = zaFakturisanjeList.reduce(
      (sum: number, r: any) => sum + Number(r.sa_pdv_km || r.budzet_planirani || 0),
      0
    );

    // Obrada otvorenih potraživanja
    const potrazivanjaList = Array.isArray(potrazivanjaRows) ? potrazivanjaRows : [];
    const potrazivanjaIznosKm = potrazivanjaList.reduce(
      (sum: number, r: any) => sum + Number(r.iznos_km || 0),
      0
    );
    const vanValuteList = potrazivanjaList.filter((r: any) => Number(r.dana_kasnjenja || 0) > 0);
    const vanValuteIznosKm = vanValuteList.reduce(
      (sum: number, r: any) => sum + Number(r.iznos_km || 0),
      0
    );

    // Obrada aktivnih projekata
    const aktivniList = Array.isArray(aktivniProjektiRows) ? aktivniProjektiRows : [];
    const aktivniBudzet = aktivniList.reduce(
      (sum: number, r: any) => sum + Number(r.budzet || 0),
      0
    );

    // Obrada računa
    const racuni = Array.isArray(racuniRows) ? racuniRows : [];
    const totalZiroFirma = racuni
      .filter((r: any) => r.tip === "FIRMA_RACUN")
      .reduce((s: number, r: any) => s + Number(r.saldo || 0), 0);
    const totalKartice = racuni
      .filter((r: any) => r.tip === "KARTICA")
      .reduce((s: number, r: any) => s + Number(r.saldo || 0), 0);
    const totalPrivatni = racuni
      .filter((r: any) => r.tip === "PRIVATNI_RACUN")
      .reduce((s: number, r: any) => s + Number(r.saldo || 0), 0);
    const totalSviRacuni = racuni.reduce((s: number, r: any) => s + Number(r.saldo || 0), 0);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      // 1. Za fakturisanje (100% tačno)
      zaFakturisanje: {
        broj: zaFakturisanjeList.length,
        budzet: Number(zaFakturisanjeIznos.toFixed(2)),
        stavke: zaFakturisanjeList
      },
      // 2. Otvorena potraživanja (100% tačno)
      fakture: {
        broj: potrazivanjaList.length,
        potrazivanja: Number(potrazivanjaIznosKm.toFixed(2)),
        vanValuteBroj: vanValuteList.length,
        vanValuteIznos: Number(vanValuteIznosKm.toFixed(2)),
        stavke: potrazivanjaList
      },
      // 3. Aktivna produkcija (100% tačno)
      projekti: {
        aktivniBroj: aktivniList.length,
        ukupnoBudzet: Number(aktivniBudzet.toFixed(2)),
        stavke: aktivniList
      },
      // 4. Inicijacije (100% tačno)
      deals: {
        broj: Number((dealsRows as any)?.[0]?.broj || 0),
        budzet: Number((dealsRows as any)?.[0]?.budzet || 0)
      },
      // 5. Stanja računa i keša (transparentna specifikacija)
      likvidnost: {
        totalZiroFirma: Number(totalZiroFirma.toFixed(2)),
        totalKartice: Number(totalKartice.toFixed(2)),
        totalPrivatni: Number(totalPrivatni.toFixed(2)),
        totalSviRacuni: Number(totalSviRacuni.toFixed(2)),
        racuniList: racuni
      },
      // 6. Master Hub Licence (tenants)
      licence: {
        ukupno: Number((tenantsRows as any)?.[0]?.ukupno_licenci || 0),
        aktivne: Number((tenantsRows as any)?.[0]?.aktivne_licence || 0)
      },
      // 7. Meets
      meets: Array.isArray(meetsRows) ? meetsRows : [],
      // 8. Trend
      trend: Array.isArray(trendRows) ? trendRows : [],
      // 9. PDV plaćeni mjeseci
      pdvPaidMonths: Array.isArray(pdvRows) ? pdvRows.map((r: any) => String(r.ym)) : []
    });
  } catch (err: any) {
    console.error("Greška u /api/dashboard/stats:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
