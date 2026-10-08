"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function loadEnvLocal(root) {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (!(v.startsWith('"') || v.startsWith("'"))) {
        v = v.replace(/\s+#.*$/, "").trim();
      }
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = v;
    }
    return;
  }
}

loadEnvLocal(path.join(__dirname, ".."));

async function migrateHome() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "studio_db";
  const ssl =
    process.env.DB_SSL === "true" || port === 25060
      ? { rejectUnauthorized: false }
      : undefined;

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    ssl,
  });

  console.log("Migrating blagajna_stavke from talent 69 to home...");
  const [res1] = await pool.query(
    "UPDATE blagajna_stavke SET entity_type = 'home', entity_id = NULL, transaction_details = 'Home: Porodica / Kuća' WHERE entity_type = 'talent' AND entity_id = 69"
  );
  console.log("Updated blagajna_stavke rows:", res1.affectedRows);

  console.log("Deactivating dummy talent 69 (! Home)...");
  const [res2] = await pool.query(
    "UPDATE talenti SET aktivan = 0 WHERE talent_id = 69"
  );
  console.log("Deactivated talent rows:", res2.affectedRows);

  const [res4] = await pool.query(
    "SELECT SUM(iznos) as total_home FROM blagajna_stavke WHERE entity_type = 'home'"
  );
  console.log("New total in Home fond:", res4[0].total_home);

  await pool.end();
  console.log("MIGRATION COMPLETED SUCCESSFULLY!");
}

migrateHome().catch(console.error);
