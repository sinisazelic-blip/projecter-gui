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

const projekatId = 5757; // <<< PROMIJENI u svoj problematični

// 1) DB istina (projekti.rok_glavni)
const dbRow = await query(
  `SELECT projekat_id, DATE_FORMAT(rok_glavni, '%Y-%m-%d') AS rok_glavni FROM projekti WHERE projekat_id = ? LIMIT 1`,
  [projekatId]
);

// 2) API istina (ono što lista guta)
const res = await fetch(`http://localhost:3000/api/projects?status_id=all&q=${projekatId}`, {
  cache: "no-store",
  headers: { "cache-control": "no-store" },
});
const json = await res.json().catch(() => null);
const apiRow = (json?.rows || [])[0] || null;

console.log(JSON.stringify({ dbRow, apiRok: apiRow?.rok_glavni, apiRow }, null, 2));
