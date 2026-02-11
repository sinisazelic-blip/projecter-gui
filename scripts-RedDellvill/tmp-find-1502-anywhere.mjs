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

const targetDate = "2026-02-15";

const rows = await query(
  `
  SELECT
    t.inicijacija_id,
    i.projekat_id,
    t.event_id,
    DATE_FORMAT(t.required_deadline, '%Y-%m-%d %H:%i:%s') AS required_deadline,
    DATE_FORMAT(t.studio_estimate,   '%Y-%m-%d %H:%i:%s') AS studio_estimate,
    DATE_FORMAT(t.accepted_deadline, '%Y-%m-%d %H:%i:%s') AS accepted_deadline,
    DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    t.note
  FROM deal_timeline_events t
  JOIN inicijacije i ON i.inicijacija_id = t.inicijacija_id
  WHERE
    DATE(t.required_deadline) = ? OR
    DATE(t.studio_estimate)   = ? OR
    DATE(t.accepted_deadline) = ?
  ORDER BY t.inicijacija_id DESC, t.event_id DESC
  LIMIT 50
`,
  [targetDate, targetDate, targetDate],
);

console.log(JSON.stringify(rows, null, 2));
