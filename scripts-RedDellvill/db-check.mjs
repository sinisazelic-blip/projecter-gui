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
    let val = s.slice(i + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { query } = await import("../src/lib/db.ts");

try {
  const rows = await query(
    `
  SELECT
    ls.snapshot_id AS ls_snapshot_id,
    ps.snapshot_id AS ps_snapshot_id,
    ps.valuta,
    COUNT(*) AS cnt,
    ROUND(SUM(ps.line_total), 2) AS sum_total
  FROM (
    SELECT projekat_id, MAX(snapshot_id) AS snapshot_id
    FROM projekat_budget_snapshots
    WHERE projekat_id = ?
    GROUP BY projekat_id
  ) ls
  LEFT JOIN projekat_stavke ps
    ON ps.projekat_id = ?
  GROUP BY ls.snapshot_id, ps.snapshot_id, ps.valuta
  ORDER BY
    (ps.snapshot_id IS NULL) ASC,
    ps.snapshot_id ASC,
    ps.valuta ASC
  `,
    [5763, 5763],
  );

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
} catch (err) {
  console.error("DB ERROR:", err);
  process.exit(1);
}
