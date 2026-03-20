/**
 * Repair narucilac_id for a single Deal (inicijacija_id) / Project (projekat_id).
 *
 * Problem:
 * - Deal #87 (inicijacija_id=87) otvorio projekat #5794 (projekat_id=5794)
 * - pogrešno je setovan narucilac (kupac koji plaća) na klijent_id=594
 * - treba biti narucilac=119 (validan i aktivan kupac)
 *
 * Radi bez MySQL Workbench-a.
 * Pokretanje:
 *   node scripts/repair-deal-narucilac.js
 *
 * Oslanja se na .env.local u rootu projekta (DB_*, DB_PORT, DB_SSL/25060 SSL).
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("Nema .env.local u rootu projekta.");

  const content = fs.readFileSync(envPath, "utf8");
  const env = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutComment = trimmed.split("#")[0].trim();
    if (!withoutComment) continue;

    const m = withoutComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;

    const key = m[1].trim();
    let value = m[2].trim();
    value = value.replace(/^["']|["']$/g, "");
    env[key] = value;
  }

  return env;
}

function mustEnv(env, name) {
  const v = env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return String(v);
}

async function main() {
  const env = loadEnvLocal();

  const DB_HOST = mustEnv(env, "DB_HOST");
  const DB_PORT = Number(env.DB_PORT || 3306);
  const DB_USER = mustEnv(env, "DB_USER");
  const DB_PASSWORD = mustEnv(env, "DB_PASSWORD");
  const DB_NAME = mustEnv(env, "DB_NAME");

  const PROJEKAT_ID = 5794;
  const DEAL_INICIJACIJA_ID = 87;
  const OLD_NARUCI_ID = 594;
  const NEW_NARUCI_ID = 119;

  const opts = {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    connectTimeout: 15000,
  };

  if (DB_PORT === 25060 || env.DB_SSL === "1" || env.DB_SSL === "true") {
    opts.ssl = { rejectUnauthorized: false };
  }

  console.log("Ciljna baza:", DB_NAME);

  const pool = mysql.createPool(opts);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [pBefore] = await conn.query(
      "SELECT projekat_id, narucilac_id FROM projekti WHERE projekat_id = ? LIMIT 1",
      [PROJEKAT_ID],
    );
    const [dBefore] = await conn.query(
      "SELECT inicijacija_id, narucilac_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1",
      [DEAL_INICIJACIJA_ID],
    );

    const [buyerCheckRows] = await conn.query(
      "SELECT klijent_id, aktivan FROM klijenti WHERE klijent_id IN (?, ?) LIMIT 2",
      [OLD_NARUCI_ID, NEW_NARUCI_ID],
    );

    const buyerNew = buyerCheckRows?.find?.((r) => Number(r.klijent_id) === NEW_NARUCI_ID);
    if (!buyerNew || Number(buyerNew.aktivan) !== 1) {
      throw new Error(
        `Klijent_id=${NEW_NARUCI_ID} nije aktivan u demo bazi (aktivan=${buyerNew ? buyerNew.aktivan : "N/A"}).`,
      );
    }

    console.log("Before:", { pBefore: pBefore?.[0] ?? null, dBefore: dBefore?.[0] ?? null });

    const [pUpdRes] = await conn.query(
      "UPDATE projekti SET narucilac_id=? WHERE projekat_id=? AND narucilac_id=?",
      [NEW_NARUCI_ID, PROJEKAT_ID, OLD_NARUCI_ID],
    );

    const [dUpdRes] = await conn.query(
      "UPDATE inicijacije SET narucilac_id=? WHERE inicijacija_id=? AND narucilac_id=?",
      [NEW_NARUCI_ID, DEAL_INICIJACIJA_ID, OLD_NARUCI_ID],
    );

    console.log("Update results:", { pAffected: pUpdRes?.affectedRows, dAffected: dUpdRes?.affectedRows });

    const [pAfter] = await conn.query(
      "SELECT projekat_id, narucilac_id FROM projekti WHERE projekat_id = ? LIMIT 1",
      [PROJEKAT_ID],
    );
    const [dAfter] = await conn.query(
      "SELECT inicijacija_id, narucilac_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1",
      [DEAL_INICIJACIJA_ID],
    );

    console.log("After:", { pAfter: pAfter?.[0] ?? null, dAfter: dAfter?.[0] ?? null });

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("Repair failed:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

