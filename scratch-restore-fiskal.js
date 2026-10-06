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

async function fix() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: env.DB_PORT ? Number(env.DB_PORT) : 3306,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Get latest valid settings from firma_id 12 or max configured
  const [validRows] = await conn.query(
    `SELECT * FROM firma_fiskal_settings WHERE base_url IS NOT NULL AND api_key IS NOT NULL ORDER BY firma_id DESC LIMIT 1`
  );

  if (validRows && validRows.length > 0) {
    const v = validRows[0];
    console.log('Restoring from valid config:', v);
    
    // Update firma_id 13 (and any active profile)
    await conn.query(
      `UPDATE firma_fiskal_settings 
       SET base_url = ?, api_path = ?, api_key = ?, yid = ?, pin = ?, use_external_printer = ?, external_printer_name = ?, external_printer_width = ?
       WHERE firma_id = 13`,
      [v.base_url, v.api_path, v.api_key, v.yid, v.pin, v.use_external_printer, v.external_printer_name, v.external_printer_width]
    );
    console.log('Updated firma_id 13 with fiskal settings successfully.');
  }

  const [after] = await conn.query('SELECT * FROM firma_fiskal_settings WHERE firma_id = 13');
  console.log('Firma 13 Settings Now:', after);

  await conn.end();
}

fix().catch(console.error);
