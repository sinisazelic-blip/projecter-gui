const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const commentIdx = trimmed.indexOf('#');
  if (commentIdx > 0) trimmed = trimmed.slice(0, commentIdx).trim();
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

async function check() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: env.DB_PORT ? Number(env.DB_PORT) : 3306,
    ssl: { rejectUnauthorized: false }
  });

  const [profiles] = await conn.query('SELECT firma_id, naziv, pravni_naziv, jib, pib, is_active FROM firma_profile');
  console.log('Profiles:', profiles);

  const [fiskal] = await conn.query('SELECT * FROM firma_fiskal_settings');
  console.log('Fiskal Settings:', fiskal);

  await conn.end();
}

check().catch(console.error);
