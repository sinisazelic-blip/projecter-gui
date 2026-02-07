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

const projekatId = 5756;

const rows = await query(
  `
  SELECT
    v.projekat_id,
    v.budzet_planirani AS v_budzet,
    v.troskovi_ukupno  AS v_troskovi,
    v.planirana_zarada AS v_zarada
  FROM vw_projekti_finansije v
  WHERE v.projekat_id = ?
  LIMIT 1
  `,
  [projekatId]
);

console.log(JSON.stringify(rows, null, 2));
