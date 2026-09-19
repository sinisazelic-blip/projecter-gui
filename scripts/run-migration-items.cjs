const fs = require('fs');
const mysql = require('mysql2/promise');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    let v = match[2].split('#')[0].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[match[1].trim()] = v;
  }
}

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT) || 3306,
    ssl: { rejectUnauthorized: false }
  });

  const [cols] = await conn.query('SHOW COLUMNS FROM plivacki_kalendar');
  const existing = new Set(cols.map(c => c.Field));

  const toAdd = [
    { name: "honorar_nacin_placanja", sql: "ALTER TABLE plivacki_kalendar ADD COLUMN honorar_nacin_placanja VARCHAR(20) DEFAULT 'FAKTURA' AFTER dnevna_tarifa_km" },
    { name: "iznos_faktura_km", sql: "ALTER TABLE plivacki_kalendar ADD COLUMN iznos_faktura_km DECIMAL(10,2) DEFAULT 0.00 AFTER ugovoreni_pausal_km" },
    { name: "iznos_kes_km", sql: "ALTER TABLE plivacki_kalendar ADD COLUMN iznos_kes_km DECIMAL(10,2) DEFAULT 0.00 AFTER iznos_faktura_km" }
  ];

  for (const col of toAdd) {
    if (!existing.has(col.name)) {
      await conn.query(col.sql);
      console.log("Added column:", col.name);
    } else {
      console.log("Column exists:", col.name);
    }
  }

  await conn.end();
  console.log("Migration finished.");
})();
