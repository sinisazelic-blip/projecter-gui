const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Parse .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

async function run() {
  const port = env.DB_PORT ? Number(env.DB_PORT) : 3306;
  const opts = {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port,
  };
  if (port === 25060 || env.DB_SSL === '1' || env.DB_SSL === 'true') {
    opts.ssl = { rejectUnauthorized: false };
  }

  const conn = await mysql.createConnection(opts);
  console.log('Connected to DB:', env.DB_NAME);

  const sqlFile = path.join(__dirname, 'migrations', '2026-09-20_osnovna_sredstva.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  await conn.query(sql);
  console.log('Migration executed successfully: osnovna_sredstva table created.');

  // Seed user's core hardware if table is empty
  const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM osnovna_sredstva');
  if (existing[0].cnt === 0) {
    console.log('Seeding initial core studio assets...');
    const assets = [
      {
        naziv: 'Master DAW Audio & Video Radna Stanica (Intel i7 Ultra 12th, 64GB RAM, 8TB SSD, GPU)',
        kategorija: 'IT_RACUNARI',
        serijski_broj: 'WS-DAW-2026-01',
        datum_nabavke: '2026-01-15',
        nabavna_vrijednost_km: 5800.00,
        stopa_amortizacije: 20.00,
        porijeklo: 'LICNA_IMOVINA_UNOS',
        opis_namjene: 'Glavni računar za višekanalno zvučno snimanje, master miks, obradu i IT administraciju.',
        status: 'U_UPOTREBI'
      },
      {
        naziv: 'Dual Monitor Setup (2x HP 27" 100% sRGB Professional Display)',
        kategorija: 'IT_RACUNARI',
        serijski_broj: 'HP-DISP-27-PAIR',
        datum_nabavke: '2026-01-20',
        nabavna_vrijednost_km: 1250.00,
        stopa_amortizacije: 20.00,
        porijeklo: 'LICNA_IMOVINA_UNOS',
        opis_namjene: 'Dva profesionalna ekrana za miks konzolu i video sinhronizaciju zvuka.',
        status: 'U_UPOTREBI'
      },
      {
        naziv: 'Laptop HP Omen 16 (Gaming/Workstation Zvijer)',
        kategorija: 'TERENSKA_MJERENJE',
        serijski_broj: 'HP-OMEN16-SWIM-01',
        datum_nabavke: '2026-02-10',
        nabavna_vrijednost_km: 2600.00,
        stopa_amortizacije: 20.00,
        porijeklo: 'LICNA_IMOVINA_UNOS',
        opis_namjene: 'Terenska radna stanica za automatsko mjerenje plivačkih takmičenja (Trebinje, Sarajevo, Banja Luka) i terenski prenos.',
        status: 'U_UPOTREBI'
      },
      {
        naziv: 'Miš Logitech MX Master 4 Wireless',
        kategorija: 'IT_RACUNARI',
        serijski_broj: 'LOGI-MXM4-STUDIO',
        datum_nabavke: '2026-03-05',
        nabavna_vrijednost_km: 180.00,
        stopa_amortizacije: 20.00,
        porijeklo: 'LICNA_IMOVINA_UNOS',
        opis_namjene: 'Ergonomski kontroler za preciznu audio montažu i režiju zvuka.',
        status: 'U_UPOTREBI'
      },
      {
        naziv: 'SOCCS Wireless & Mjerna Mrežna Oprema (WiFi bazni linkovi, senzori i kontroleri)',
        kategorija: 'TERENSKA_MJERENJE',
        serijski_broj: 'SOCCS-NET-SYS-2026',
        datum_nabavke: '2026-04-12',
        nabavna_vrijednost_km: 1300.00,
        stopa_amortizacije: 20.00,
        porijeklo: 'LICNA_IMOVINA_UNOS',
        opis_namjene: 'Kompletan sistem mjerne bežične infrastrukture za sportska takmičenja.',
        status: 'U_UPOTREBI'
      }
    ];

    for (const a of assets) {
      await conn.query(
        `INSERT INTO osnovna_sredstva 
        (naziv, kategorija, serijski_broj, datum_nabavke, nabavna_vrijednost_km, stopa_amortizacije, porijeklo, opis_namjene, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.naziv, a.kategorija, a.serijski_broj, a.datum_nabavke, a.nabavna_vrijednost_km, a.stopa_amortizacije, a.porijeklo, a.opis_namjene, a.status]
      );
    }
    console.log('Seeded 5 core assets successfully.');
  }

  await conn.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
