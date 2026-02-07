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
    p.projekat_id,

    -- latest snapshot id (kako ga view vidi)
    ls.snapshot_id AS ls_snapshot_id,

    -- kakvi snapshot_id stvarno postoje na stavkama (NULL / brojevi)
    COUNT(*) AS ps_rows,
    GROUP_CONCAT(DISTINCT COALESCE(CAST(ps.snapshot_id AS CHAR), 'NULL') ORDER BY COALESCE(ps.snapshot_id, 0)) AS ps_snapshot_ids,

    -- suma koja bi ušla u view (samo stavke sa ls.snapshot_id)
    ROUND(SUM(CASE WHEN ps.snapshot_id = ls.snapshot_id THEN ps.line_total ELSE 0 END), 2) AS sum_match_ls,

    -- suma živih stavki bez snapshot-a (NULL)
    ROUND(SUM(CASE WHEN ps.snapshot_id IS NULL THEN ps.line_total ELSE 0 END), 2) AS sum_null_snapshot,

    -- suma svih stavki ukupno (kontrola)
    ROUND(SUM(ps.line_total), 2) AS sum_all
  FROM projekti p
  LEFT JOIN (
    SELECT projekat_id, MAX(snapshot_id) AS snapshot_id
    FROM projekat_budget_snapshots
    GROUP BY projekat_id
  ) ls ON ls.projekat_id = p.projekat_id
  LEFT JOIN projekat_stavke ps ON ps.projekat_id = p.projekat_id
  WHERE p.projekat_id = ?
  GROUP BY p.projekat_id, ls.snapshot_id
  `,
  [projekatId]
);

console.log(JSON.stringify(rows, null, 2));
