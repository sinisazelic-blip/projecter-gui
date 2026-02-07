import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i === -1) continue;
    const key = s.slice(0, i).trim();
    const val = s.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const { query } = await import("../src/lib/db.ts");

const rows = await query(`
  SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND (
      COLUMN_NAME LIKE '%rok%' OR
      COLUMN_NAME LIKE '%dead%' OR
      COLUMN_NAME LIKE '%accept%' OR
      COLUMN_NAME LIKE '%timeline%' OR
      TABLE_NAME  LIKE '%timeline%' OR
      TABLE_NAME  LIKE '%rok%' OR
      TABLE_NAME  LIKE '%dead%'
    )
  ORDER BY TABLE_NAME, ORDINAL_POSITION
`);

console.log(JSON.stringify(rows, null, 2));
