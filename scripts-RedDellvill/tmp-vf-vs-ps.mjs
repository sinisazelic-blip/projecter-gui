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
    const val = s.slice(i + 1).trim(); // u .env.local kod tebe nema navodnika, ovo je dovoljno
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { query } = await import("../src/lib/db.ts");

const rows = await query(`
  SELECT
    v.projekat_id,
    v.budzet_planirani AS v_budzet,
    v.troskovi_ukupno  AS v_troskovi,
    v.planirana_zarada AS v_zarada,
    COALESCE(ps_all.ps_sum, 0) AS ps_sum_all,
    COALESCE(ps_all.valute, '') AS ps_valute
  FROM vw_projekti_finansije v
  LEFT JOIN (
    SELECT
      projekat_id,
      ROUND(SUM(line_total),2) AS ps_sum,
      GROUP_CONCAT(DISTINCT valuta ORDER BY valuta) AS valute
    FROM projekat_stavke
    GROUP BY projekat_id
  ) ps_all ON ps_all.projekat_id = v.projekat_id
  WHERE ROUND(v.budzet_planirani,2) = 0
    AND COALESCE(ps_all.ps_sum,0) > 0
  ORDER BY v.projekat_id DESC
  LIMIT 30
`);

console.log(JSON.stringify(rows, null, 2));
