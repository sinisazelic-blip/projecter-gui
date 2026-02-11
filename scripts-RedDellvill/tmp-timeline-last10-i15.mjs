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

const inicijacijaId = 15;

const rows = await query(
  `
  SELECT
    event_id,
    DATE_FORMAT(accepted_deadline, '%Y-%m-%d %H:%i:%s') AS accepted_deadline,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
  FROM deal_timeline_events
  WHERE inicijacija_id = ?
  ORDER BY event_id DESC
  LIMIT 10
`,
  [inicijacijaId],
);

console.log(JSON.stringify(rows, null, 2));
