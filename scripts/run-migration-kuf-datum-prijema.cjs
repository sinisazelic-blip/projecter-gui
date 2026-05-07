const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function parseEnvLocal(filePath) {
  const out = {};
  const txt = fs.readFileSync(filePath, "utf8");
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const hash = val.indexOf("#");
    if (hash >= 0) val = val.slice(0, hash).trim();
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, ".env.local");
  const env = fs.existsSync(envPath) ? parseEnvLocal(envPath) : {};

  const host = env.DB_HOST;
  const port = Number(env.DB_PORT || 3306);
  const user = env.DB_USER;
  const password = env.DB_PASSWORD;
  const database = String(env.DB_NAME || "").split("#")[0].trim();

  if (!host || !user || !database) {
    throw new Error("Missing DB_* config in .env.local");
  }

  const migrationPath = path.join(
    root,
    "scripts-RedDellvill",
    "migrations",
    "2026-05-06_kuf_datum_prijema_knjizenja.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false },
  });

  await conn.query(sql);

  const [col] = await conn.query(
    "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='kuf_ulazne_fakture' AND column_name='datum_prijema' LIMIT 1",
  );
  const [idx] = await conn.query(
    "SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='kuf_ulazne_fakture' AND index_name='idx_kuf_datum_prijema' LIMIT 1",
  );

  await conn.end();

  process.stdout.write(
    `datum_prijema: ${Array.isArray(col) && col.length ? "OK" : "MISSING"}\n`,
  );
  process.stdout.write(
    `idx_kuf_datum_prijema: ${Array.isArray(idx) && idx.length ? "OK" : "MISSING"}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

