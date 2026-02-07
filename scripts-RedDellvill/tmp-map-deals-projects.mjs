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
    i.radni_naziv,
    DATE_FORMAT(p.rok_glavni, '%Y-%m-%d') AS project_rok_glavni,

    -- last accepted from timeline (ako postoji)
    DATE_FORMAT(dte.accepted_deadline, '%Y-%m-%d %H:%i:%s') AS last_accepted_deadline

  FROM inicijacije i
  LEFT JOIN projekti p ON p.projekat_id = i.projekat_id
  LEFT JOIN (
    SELECT t.inicijacija_id, t.accepted_deadline
    FROM deal_timeline_events t
    JOIN (
      SELECT inicijacija_id, MAX(event_id) AS max_event_id
      FROM deal_timeline_events
      GROUP BY inicijacija_id
    ) last ON last.inicijacija_id = t.inicijacija_id AND last.max_event_id = t.event_id
  ) dte ON dte.inicijacija_id = i.inicijacija_id

  WHERE
    i.inicijacija_id IN (6,15)
    OR i.projekat_id IN (5757,5759)

  ORDER BY i.inicijacija_id ASC
`);

console.log(JSON.stringify(rows, null, 2));
