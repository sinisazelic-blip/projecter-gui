"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

function loadEnv(root) {
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

function mustEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Nedostaje env: ${name}`);
  return value;
}

async function main() {
  const root = path.join(__dirname, "..");
  loadEnv(root);

  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const conn = await mysql.createConnection({
    host: mustEnv("DB_HOST"),
    user: mustEnv("DB_USER"),
    password: mustEnv("DB_PASSWORD"),
    database: mustEnv("DB_NAME"),
    port,
    ssl:
      port === 25060 ||
      process.env.DB_SSL === "1" ||
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    console.log("Connected to database:", process.env.DB_NAME);

    // 1. Check roles
    const [roles] = await conn.query("SELECT * FROM roles");
    console.log("Existing roles:", roles);

    let osRole = roles.find((r) => String(r.naziv).toLowerCase() === "os+troskovi" || String(r.naziv).toLowerCase() === "os_troskovi");

    if (!osRole) {
      const [insertRes] = await conn.query(
        "INSERT INTO roles (naziv, opis, nivo_ovlascenja, created_at, updated_at) VALUES (?, ?, 2, NOW(), NOW())",
        ["OS+troskovi", "Evidencija gotovinskih računa, poreskog pravdanja i osnovnih sredstava"]
      );
      const roleId = insertRes.insertId;
      console.log("Created role OS+troskovi with ID:", roleId);
      osRole = { role_id: roleId, naziv: "OS+troskovi", nivo_ovlascenja: 2 };
    } else {
      console.log("Found existing OS+troskovi role ID:", osRole.role_id);
    }

    // 2. Check users
    const [users] = await conn.query("SELECT user_id, username, role_id, aktivan FROM users");
    console.log("Existing users:", users);

    const osAcl = {
      dashboard: "view",
      deals: "edit",
      pp: "edit",
      projekat: "edit",
      mali_racuni: "edit",
      osnovna_sredstva: "edit",
      klijenti: "edit",
      saradnici: "edit",
      dobavljaci: "edit",
      cjenovnik: "edit",
      radnici: "edit",
      faze: "edit",
      firma: "edit",
      // explicitly blocked
      fakture: "none",
      naplate: "none",
      pdv: "none",
      kif: "none",
      kuf: "none",
      izvodi: "none",
      potrazivanja: "none",
      dugovanja: "none",
      banka: "none",
      blagajna: "none",
      otpis: "none",
      pocetna_stanja: "none",
      rasknjizavanje: "none",
      izvjestaji: "none",
      users: "none",
      roles: "none",
      mobile: "none",
      strategic_core: "none"
    };

    const osAclJson = JSON.stringify(osAcl);

    let [existingUsers] = await conn.query("SELECT user_id, username, role_id, aktivan FROM users WHERE username = 'ostroskovi'");
    const passwordHash = await bcrypt.hash("ostroskovi", 10);
    let userId;

    if (!existingUsers.length) {
      const [res] = await conn.query(
        "INSERT INTO users (username, password, password_hash, role_id, aktivan, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())",
        ["ostroskovi", passwordHash, passwordHash, osRole.role_id]
      );
      userId = res.insertId;
      console.log("Created user 'ostroskovi' with ID:", userId, "(password: ostroskovi)");
    } else {
      userId = existingUsers[0].user_id;
      await conn.query(
        "UPDATE users SET role_id = ?, password = ?, password_hash = ?, aktivan = 1, updated_at = NOW() WHERE user_id = ?",
        [osRole.role_id, passwordHash, passwordHash, userId]
      );
      console.log("Updated user 'ostroskovi' ID:", userId);
    }

    // Ensure user_module_acl table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_module_acl (
        user_id INT NOT NULL,
        module_key VARCHAR(64) NOT NULL,
        access ENUM('none','view','edit') NOT NULL DEFAULT 'none',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, module_key),
        KEY idx_user_module_acl_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query("DELETE FROM user_module_acl WHERE user_id = ?", [userId]);
    for (const [k, v] of Object.entries(osAcl)) {
      await conn.query(
        "INSERT INTO user_module_acl (user_id, module_key, access) VALUES (?, ?, ?)",
        [userId, k, v]
      );
    }
    console.log("Saved ACL for user 'ostroskovi' successfully.");

  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
