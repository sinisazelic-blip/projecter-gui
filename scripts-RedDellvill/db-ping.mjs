// scripts/db-ping.mjs  (no deps; reads .env.local/.env if present)
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

function loadEnvFile(file) {
  try {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) return false;

    const raw = fs.readFileSync(full, "utf8");
    for (const lineRaw of raw.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();

      // remove optional quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      // don't override already-set env vars
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function req(name, fallback = null) {
  const v = process.env[name] ?? fallback;
  if (v === null || v === undefined || String(v).trim() === "") {
    throw new Error(`Missing env var: ${name}`);
  }
  return String(v);
}

(async () => {
  // Try common env files (Next.js style)
  const loaded =
    loadEnvFile(".env.local") ||
    loadEnvFile(".env") ||
    loadEnvFile(".env.development.local") ||
    loadEnvFile(".env.development");

  if (!loaded) {
    console.log("ℹ️  No .env files found in project root (looked for .env.local/.env/...)");
  }

  const cfg = {
    host: req("DB_HOST", process.env.MYSQL_HOST ?? null),
    user: req("DB_USER", process.env.MYSQL_USER ?? null),
    password: req("DB_PASSWORD", process.env.MYSQL_PASSWORD ?? ""),
    database: req("DB_NAME", process.env.MYSQL_DATABASE ?? null),
    port: Number(process.env.DB_PORT ?? process.env.MYSQL_PORT ?? 3306),
    ssl:
      process.env.DB_SSL === "1" || process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  };

  console.log("DB ping config:", {
    host: cfg.host,
    user: cfg.user,
    database: cfg.database,
    port: cfg.port,
    ssl: cfg.ssl ? "on" : "off",
  });

  let conn;
  try {
    conn = await mysql.createConnection(cfg);
    const [rows] = await conn.query(
  "SELECT 1 AS ok, NOW() AS now, DATABASE() AS db, USER() AS user_name, VERSION() AS version"
);

    console.log("✅ CONNECTED");
    console.table(rows);
  } catch (err) {
    console.error("❌ FAILED TO CONNECT");
    console.error(err?.code ?? err?.name ?? "Error", err?.message ?? err);
    if (err?.errno) console.error("errno:", err.errno);
    process.exitCode = 1;
  } finally {
    try { await conn?.end(); } catch {}
  }
})();
