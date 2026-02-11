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
    p.rok_glavni AS p_rok_glavni_raw,
    tl.accepted_deadline AS tl_accepted_raw,
    COALESCE(p.rok_glavni, tl.accepted_deadline) AS coalesced_raw
  FROM inicijacije i
  LEFT JOIN projekti p ON p.projekat_id = i.projekat_id
  LEFT JOIN (
    SELECT t1.inicijacija_id, t1.accepted_deadline
    FROM deal_timeline_events t1
    JOIN (
      SELECT inicijacija_id, MAX(event_id) AS max_event_id
      FROM deal_timeline_events
      GROUP BY inicijacija_id
    ) t2 ON t2.inicijacija_id = t1.inicijacija_id AND t2.max_event_id = t1.event_id
  ) tl ON tl.inicijacija_id = i.inicijacija_id
  WHERE i.inicijacija_id IN (3,6,15)
  ORDER BY i.inicijacija_id ASC
`);

const out = rows.map((r) => ({
  inicijacija_id: r.inicijacija_id,
  projekat_id: r.projekat_id,
  p_rok_glavni_raw: r.p_rok_glavni_raw,
  p_type: typeof r.p_rok_glavni_raw,
  tl_accepted_raw: r.tl_accepted_raw,
  tl_type: typeof r.tl_accepted_raw,
  coalesced_raw: r.coalesced_raw,
  coalesced_type: typeof r.coalesced_raw,
  // ako je Date objekat  vidi ISO
  coalesced_iso:
    r.coalesced_raw instanceof Date ? r.coalesced_raw.toISOString() : null,
}));

console.log(JSON.stringify(out, null, 2));
