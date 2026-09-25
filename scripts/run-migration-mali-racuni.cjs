"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnv(root) {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      v = v.replace(/\s+#.*$/, "").trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnv(root);

  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port,
    ssl:
      port === 25060 || process.env.DB_SSL === "1" || process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS mali_racuni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broj_racuna VARCHAR(100) NOT NULL COMMENT 'Broj fiskalnog/malog računa (BI broj)',
        datum_racuna DATE NOT NULL,
        dobavljac VARCHAR(255) NOT NULL COMMENT 'Prodajno mjesto / izdavalac računa',
        kategorija VARCHAR(100) NOT NULL DEFAULT 'GORIVO' COMMENT 'GORIVO, POSTARINA, KANCELARIJA, OPREMA, REPREZENTACIJA, ODRZAVANJE, OSTALO',
        iznos_ukupno DECIMAL(12, 2) NOT NULL,
        iznos_osnovica DECIMAL(12, 2) NULL,
        iznos_pdv DECIMAL(12, 2) NULL,
        valuta VARCHAR(10) NOT NULL DEFAULT 'BAM',
        svrha TEXT NULL COMMENT 'Opis troška i namjena za Studio TAF',
        status_pravdanja VARCHAR(50) NOT NULL DEFAULT 'SPREMNO_ZA_KNJIGOVOĐU' COMMENT 'SPREMNO_ZA_KNJIGOVOĐU, PREUZETO_OD_KNJIGOVOĐE, UKNJIŽENO, OPRAVDANO_IZ_DOBITI',
        godina_obracuna INT NOT NULL DEFAULT 2026,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_godina (godina_obracuna),
        INDEX idx_datum (datum_racuna),
        INDEX idx_kategorija (kategorija)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Kreirana tabela mali_racuni (ako nije postojala).");
    console.log("Migracija mali_racuni završena uspješno.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
