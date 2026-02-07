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
    i.inicijacija_id,
    i.projekat_id,
    DATE_FORMAT(i.accepted_deadline, '%Y-%m-%d %H:%i:%s') AS deal_accepted_deadline,
    DATE_FORMAT(p.rok_glavni, '%Y-%m-%d %H:%i:%s')       AS project_rok_glavni
  FROM inicijacije i
  JOIN projekti p ON p.projekat_id = i.projekat_id
  WHERE i.projekat_id IS NOT NULL
    AND i.accepted_deadline IS NOT NULL
    AND (p.rok_glavni IS NULL OR p.rok_glavni <> i.accepted_deadline)
  ORDER BY i.projekat_id DESC
  LIMIT 30
`);

console.log(JSON.stringify(rows, null, 2));
