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

const inicijacijaId = 3;
const targetDate = "2026-02-15";

const rows = await query(`
  SELECT
    event_id,
    DATE_FORMAT(required_deadline, '%Y-%m-%d %H:%i:%s') AS required_deadline,
    DATE_FORMAT(studio_estimate,   '%Y-%m-%d %H:%i:%s') AS studio_estimate,
    DATE_FORMAT(accepted_deadline, '%Y-%m-%d %H:%i:%s') AS accepted_deadline,
    note,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
  FROM deal_timeline_events
  WHERE inicijacija_id = ?
    AND (
      DATE(required_deadline) = ? OR
      DATE(studio_estimate)   = ? OR
      DATE(accepted_deadline) = ?
    )
  ORDER BY event_id DESC
`, [inicijacijaId, targetDate, targetDate, targetDate]);

console.log(JSON.stringify(rows, null, 2));
