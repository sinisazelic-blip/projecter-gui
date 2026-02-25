/**
 * Seed demo baze – ubacuje lažne klijente, projekte, talente, dobavljače i minimalne šifarnike
 * za prikaz u UI-u. Koristi DB_* iz .env.local (postavi DB_NAME=studio_db_demo).
 *
 * Pokretanje: node scripts/seed-demo.js
 * (iz root foldera projekta)
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Nema .env.local u rootu projekta.");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    // Preskoči prazne linije i komentare
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Ukloni komentar sa kraja linije (sve nakon #)
    const withoutComment = trimmed.split("#")[0].trim();
    if (!withoutComment) continue;
    
    // Parsiraj KEY=VALUE
    const m = withoutComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      let value = m[2].trim();
      // Ukloni quotes ako postoje
      value = value.replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const dbName = env.DB_NAME || process.env.DB_NAME;
  if (!dbName) {
    console.error("U .env.local nedostaje DB_NAME.");
    process.exit(1);
  }
  console.log("Ciljna baza:", dbName);
  if (!dbName.includes("demo")) {
    console.warn("Upozorenje: DB_NAME ne sadrži 'demo'. Za demo koristi npr. studio_db_demo.");
  }

  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // ----- statusi_projekta (projekti.status_id FK) -----
    const [existingSp] = await conn.query("SELECT 1 FROM statusi_projekta LIMIT 1");
    if (existingSp.length === 0) {
      await conn.query(`
        INSERT INTO statusi_projekta (status_id, naziv_statusa, opis, redoslijed, aktivan, core_faza) VALUES
        (1, 'U pripremi', 'Projekat u pripremi', 1, 1, 'draft'),
        (2, 'Aktivan', 'Projekat u toku', 2, 1, 'active'),
        (3, 'Zatvoren', 'Projekat završen', 3, 1, 'closed')
      `);
      console.log("  + statusi_projekta (3 reda)");
    }

    // ----- projekt_statusi (API project-statuses) -----
    const [existingPs] = await conn.query("SELECT 1 FROM projekt_statusi LIMIT 1");
    if (existingPs.length === 0) {
      await conn.query(`
        INSERT INTO projekt_statusi (status_id, kod, naziv, opis, sort, redoslijed) VALUES
        (1, 'priprema', 'U pripremi', NULL, 1, 1),
        (2, 'aktivan', 'Aktivan', NULL, 2, 2),
        (3, 'zatvoren', 'Zatvoren', NULL, 3, 3)
      `);
      console.log("  + projekt_statusi (3 reda)");
    }

    // ----- statusi (za inicijacije/deals) -----
    const [existingSt] = await conn.query("SELECT 1 FROM statusi WHERE entitet = 'inicijacija' LIMIT 1");
    if (existingSt.length === 0) {
      await conn.query(`
        INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES
        ('inicijacija', 'otvorena', 'Otvorena', 1, 1),
        ('inicijacija', 'dobijena', 'Dobijena', 2, 1),
        ('inicijacija', 'izgubljena', 'Izgubljena', 3, 1)
      `);
      console.log("  + statusi inicijacija (3 reda)");
    }

    // ----- klijenti -----
    const [existingK] = await conn.query("SELECT 1 FROM klijenti LIMIT 1");
    if (existingK.length === 0) {
      await conn.query(`
        INSERT INTO klijenti (naziv_klijenta, tip_klijenta, adresa, grad, drzava, email, rok_placanja_dana, aktivan) VALUES
        ('Demo TV d.o.o.', 'direktni', 'Demo ulica 1', 'Sarajevo', 'BiH', 'demo@demo.ba', 14, 1),
        ('Agencija Demo', 'agencija', 'Agencijska 5', 'Mostar', 'BiH', 'agencija@demo.ba', 30, 1),
        ('Ino Client Ltd', 'direktni', 'Foreign St 10', 'London', 'UK', 'ino@demo.com', 30, 1)
      `);
      console.log("  + klijenti (3)");
    }

    // ----- projekti (narucilac_id, status_id) -----
    const [klijentIds] = await conn.query("SELECT klijent_id FROM klijenti ORDER BY klijent_id LIMIT 3");
    const [projCount] = await conn.query("SELECT COUNT(*) AS c FROM projekti");
    if (projCount[0].c === 0 && klijentIds.length > 0) {
      const k1 = klijentIds[0].klijent_id;
      const k2 = klijentIds[1]?.klijent_id ?? k1;
      await conn.query(
        `
        INSERT INTO projekti (narucilac_id, radni_naziv, naziv_za_fakturu, status_id, rok_glavni, budzet_planirani, is_test) VALUES
        (?, 'Demo kampanja 2026', 'Demo kampanja 2026', 1, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 15000.00, 1),
        (?, 'Spot za brend X', 'Spot za brend X', 2, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 8000.00, 1),
        (?, 'Event pokroviteljstvo', 'Event pokroviteljstvo', 1, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 25000.00, 1)
      `,
        [k1, k2, k1]
      );
      console.log("  + projekti (3)");
    }

    // ----- talenti -----
    const [talCount] = await conn.query("SELECT COUNT(*) AS c FROM talenti");
    if (talCount[0].c === 0) {
      await conn.query(`
        INSERT INTO talenti (ime_prezime, vrsta, email, aktivan) VALUES
        ('Demo Spiker', 'spiker', 'spiker@demo.ba', 1),
        ('Demo Glumac', 'glumac', 'glumac@demo.ba', 1),
        ('Demo Muzičar', 'muzicar', NULL, 1)
      `);
      console.log("  + talenti (3)");
    }

    // ----- dobavljaci -----
    const [dobCount] = await conn.query("SELECT COUNT(*) AS c FROM dobavljaci");
    if (dobCount[0].c === 0) {
      await conn.query(`
        INSERT INTO dobavljaci (naziv, vrsta, pravno_lice, grad, email, aktivan) VALUES
        ('Demo Studio', 'studio', 1, 'Sarajevo', 'studio@demo.ba', 1),
        ('Demo Freelancer', 'freelancer', 0, 'Mostar', 'freelancer@demo.ba', 1)
      `);
      console.log("  + dobavljaci (2)");
    }

    // ----- radne_faze (opciono, za fazne prikaze) -----
    const [fazeCount] = await conn.query("SELECT COUNT(*) AS c FROM radne_faze");
    if (fazeCount[0].c === 0) {
      await conn.query(`
        INSERT INTO radne_faze (naziv, opis_poslova, vrsta_posla, aktivna) VALUES
        ('Preprodukcija', 'Priprema', 'produkcija', 1),
        ('Produkcija', 'Snimanje', 'produkcija', 1),
        ('Postprodukcija', 'Montaža i finalizacija', 'produkcija', 1)
      `);
      console.log("  + radne_faze (3)");
    }

    // ----- cjenovnik_stavke (opciono) -----
    const [cjenCount] = await conn.query("SELECT COUNT(*) AS c FROM cjenovnik_stavke");
    if (cjenCount[0].c === 0) {
      await conn.query(`
        INSERT INTO cjenovnik_stavke (naziv, jedinica, cijena_default, valuta_default, sort_order, active) VALUES
        ('Demo stavka po satu', 'SAT', 50.00, 'BAM', 100, 1),
        ('Demo stavka po danu', 'DAN', 400.00, 'BAM', 200, 1),
        ('Demo stavka komad', 'KOM', 100.00, 'BAM', 300, 1)
      `);
      console.log("  + cjenovnik_stavke (3)");
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("\nSeed završen. Osvježi stranice u aplikaciji (Klijenti, Projekti, Talenti, Dobavljači, Cjenovnik).");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
