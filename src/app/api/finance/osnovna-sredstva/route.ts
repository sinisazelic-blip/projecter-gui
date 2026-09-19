import { NextResponse } from "next/server";
import { query } from "@/lib/db";

async function ensureTableAndSeed() {
  await query(`
    CREATE TABLE IF NOT EXISTS osnovna_sredstva (
      id INT AUTO_INCREMENT PRIMARY KEY,
      naziv VARCHAR(255) NOT NULL,
      kategorija ENUM('IT_RACUNARI', 'AUDIO_STUDIO', 'TERENSKA_MJERENJE', 'VOZILO', 'OSTALO') NOT NULL DEFAULT 'IT_RACUNARI',
      serijski_broj VARCHAR(100) NULL,
      datum_nabavke DATE NOT NULL,
      nabavna_vrijednost_km DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      stopa_amortizacije DECIMAL(5,2) NOT NULL DEFAULT 20.00,
      porijeklo ENUM('LICNA_IMOVINA_UNOS', 'FAKTURA_DOBAVLJAC', 'UGOVOR_FIZICKO_LICE') NOT NULL DEFAULT 'LICNA_IMOVINA_UNOS',
      opis_namjene TEXT NULL,
      status ENUM('U_UPOTREBI', 'RASHODOVANO', 'PRODATO') NOT NULL DEFAULT 'U_UPOTREBI',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const existing = await query(`SELECT COUNT(*) as cnt FROM osnovna_sredstva`);
  if (existing?.[0]?.cnt === 0) {
    const assets = [
      [
        'Master DAW Audio & Video Radna Stanica (Intel i7 Ultra 12th, 64GB RAM, 8TB SSD, GPU)',
        'IT_RACUNARI',
        'WS-DAW-2026-01',
        '2026-01-15',
        5800.00,
        20.00,
        'LICNA_IMOVINA_UNOS',
        'Glavni računar za višekanalno zvučno snimanje, master miks, obradu i IT administraciju.',
        'U_UPOTREBI'
      ],
      [
        'Dual Monitor Setup (2x HP 27" 100% sRGB Professional Display)',
        'IT_RACUNARI',
        'HP-DISP-27-PAIR',
        '2026-01-20',
        1250.00,
        20.00,
        'LICNA_IMOVINA_UNOS',
        'Dva profesionalna ekrana za miks konzolu i video sinhronizaciju zvuka.',
        'U_UPOTREBI'
      ],
      [
        'Laptop HP Omen 16 (Gaming/Workstation Zvijer)',
        'TERENSKA_MJERENJE',
        'HP-OMEN16-SWIM-01',
        '2026-02-10',
        2600.00,
        20.00,
        'LICNA_IMOVINA_UNOS',
        'Terenska radna stanica za automatsko mjerenje plivačkih takmičenja (Trebinje, Sarajevo, Banja Luka) i terenski prenos.',
        'U_UPOTREBI'
      ],
      [
        'Miš Logitech MX Master 4 Wireless',
        'IT_RACUNARI',
        'LOGI-MXM4-STUDIO',
        '2026-03-05',
        180.00,
        20.00,
        'LICNA_IMOVINA_UNOS',
        'Ergonomski kontroler za preciznu audio montažu i režiju zvuka.',
        'U_UPOTREBI'
      ],
      [
        'SOCCS Wireless & Mjerna Mrežna Oprema (WiFi bazni linkovi, senzori i kontroleri)',
        'TERENSKA_MJERENJE',
        'SOCCS-NET-SYS-2026',
        '2026-04-12',
        1300.00,
        20.00,
        'LICNA_IMOVINA_UNOS',
        'Kompletan sistem mjerne bežične infrastrukture za sportska takmičenja.',
        'U_UPOTREBI'
      ]
    ];

    for (const a of assets) {
      await query(
        `INSERT INTO osnovna_sredstva 
        (naziv, kategorija, serijski_broj, datum_nabavke, nabavna_vrijednost_km, stopa_amortizacije, porijeklo, opis_namjene, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a
      );
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTableAndSeed();

    const url = new URL(req.url);
    const targetYear = Number(url.searchParams.get("year")) || new Date().getFullYear();

    const rows = await query<any>(
      `SELECT * FROM osnovna_sredstva ORDER BY datum_nabavke DESC, id DESC`
    );

    let totalNabavna = 0;
    let totalGodisnjaAmortizacija = 0;
    let totalSadasnjaVrijednost = 0;

    const items = rows.map((r) => {
      const nabavna = Number(r.nabavna_vrijednost_km) || 0;
      const stopa = Number(r.stopa_amortizacije) || 20;
      const godisnjiOtpis = Math.round((nabavna * (stopa / 100)) * 100) / 100;
      
      const nabavkaYear = r.datum_nabavke ? new Date(r.datum_nabavke).getFullYear() : targetYear;
      const yearsActive = Math.max(0, targetYear - nabavkaYear + 1);
      const akumulirana = Math.min(nabavna, Math.round(godisnjiOtpis * yearsActive * 100) / 100);
      const sadasnja = Math.max(0, Math.round((nabavna - akumulirana) * 100) / 100);

      const isActiveInYear = nabavkaYear <= targetYear && r.status === 'U_UPOTREBI';
      const amortizacijaZaGodinu = isActiveInYear ? (sadasnja > 0 ? Math.min(sadasnja + godisnjiOtpis, godisnjiOtpis) : 0) : 0;

      totalNabavna += nabavna;
      if (isActiveInYear) {
        totalGodisnjaAmortizacija += amortizacijaZaGodinu;
        totalSadasnjaVrijednost += sadasnja;
      }

      return {
        ...r,
        nabavna_vrijednost_km: nabavna,
        stopa_amortizacije: stopa,
        godisnji_otpis_km: godisnjiOtpis,
        amortizacija_za_godinu_km: amortizacijaZaGodinu,
        akumulirana_amortizacija_km: akumulirana,
        sadasnja_vrijednost_km: sadasnja,
      };
    });

    return NextResponse.json({
      ok: true,
      year: targetYear,
      summary: {
        ukupno_nabavna_km: Math.round(totalNabavna * 100) / 100,
        ukupno_godisnja_amortizacija_km: Math.round(totalGodisnjaAmortizacija * 100) / 100,
        ukupno_sadasnja_vrijednost_km: Math.round(totalSadasnjaVrijednost * 100) / 100,
        broj_sredstava: items.length,
      },
      items,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTableAndSeed();
    const body = await req.json();

    const {
      naziv,
      kategorija,
      serijski_broj,
      datum_nabavke,
      nabavna_vrijednost_km,
      stopa_amortizacije,
      porijeklo,
      opis_namjene,
      status,
    } = body;

    if (!naziv || !datum_nabavke || nabavna_vrijednost_km == null) {
      return NextResponse.json({ ok: false, error: "Naziv, datum nabavke i nabavna vrijednost su obavezni." }, { status: 400 });
    }

    const res = await query<any>(
      `INSERT INTO osnovna_sredstva 
      (naziv, kategorija, serijski_broj, datum_nabavke, nabavna_vrijednost_km, stopa_amortizacije, porijeklo, opis_namjene, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        naziv.trim(),
        kategorija || 'IT_RACUNARI',
        serijski_broj ? serijski_broj.trim() : null,
        String(datum_nabavke).slice(0, 10),
        Number(nabavna_vrijednost_km) || 0,
        Number(stopa_amortizacije) || 20.00,
        porijeklo || 'LICNA_IMOVINA_UNOS',
        opis_namjene ? opis_namjene.trim() : null,
        status || 'U_UPOTREBI',
      ]
    );

    return NextResponse.json({ ok: true, id: (res as any)?.insertId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      naziv,
      kategorija,
      serijski_broj,
      datum_nabavke,
      nabavna_vrijednost_km,
      stopa_amortizacije,
      porijeklo,
      opis_namjene,
      status,
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    await query(
      `UPDATE osnovna_sredstva SET
        naziv = ?,
        kategorija = ?,
        serijski_broj = ?,
        datum_nabavke = ?,
        nabavna_vrijednost_km = ?,
        stopa_amortizacije = ?,
        porijeklo = ?,
        opis_namjene = ?,
        status = ?
      WHERE id = ?`,
      [
        naziv.trim(),
        kategorija || 'IT_RACUNARI',
        serijski_broj ? serijski_broj.trim() : null,
        String(datum_nabavke).slice(0, 10),
        Number(nabavna_vrijednost_km) || 0,
        Number(stopa_amortizacije) || 20.00,
        porijeklo || 'LICNA_IMOVINA_UNOS',
        opis_namjene ? opis_namjene.trim() : null,
        status || 'U_UPOTREBI',
        Number(id)
      ]
    );

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    await query(`DELETE FROM osnovna_sredstva WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
