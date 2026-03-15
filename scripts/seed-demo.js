/**
 * Seed demo baze – ubacuje lažne klijente, projekte, talente, dobavljače i šifarnike
 * za prikaz u UI-u. Svi podaci su međunarodni (EU/svijet), bez reference na BiH.
 *
 * POKRETANJE (iz root foldera projekta):
 *   1. U .env.local postavi: DB_NAME=studio_db_demo (i DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)
 *   2. node scripts/seed-demo.js
 *
 * Za praznu demo bazu seed ubaci sve. Ako tabela već ima podatke, dopunjava šifarnike
 * i samo one "dodatne" blokove koji provjeravaju email/tag (klijenti +2, talenti +2, inicijacije, fakture, izvod).
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Nema .env.local u rootu projekta.");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    // Preskoči prazne linije i komentare
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Ukloni komentar sa kraja linije (sve nakon #)
    const withoutComment = trimmed.split("#")[0].trim();
    if (!withoutComment) continue;
    
    // Parsiraj KEY=VALUE
    const m = withoutComment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      let value = m[2].trim();
      // Ukloni quotes ako postoje
      value = value.replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const dbName = env.DB_NAME || process.env.DB_NAME;
  if (!dbName) {
    console.error("U .env.local nedostaje DB_NAME.");
    process.exit(1);
  }
  console.log("Ciljna baza:", dbName);
  if (!dbName.includes("demo")) {
    console.warn("Upozorenje: DB_NAME ne sadrži 'demo'. Za demo koristi npr. studio_db_demo.");
  }

  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const seedTag = "DEMO_SEED_2026";

    // ----- statusi_projekta (projekti.status_id FK) – potrebno svih 12 za FINAL OK / Close -----
    const fullStatusiProjekta = [
      [1, "Open", "Project in preparation", 1, 1, "draft"],
      [2, "In progress", "Project in progress", 2, 1, "active"],
      [3, "Service", "Service phase", 3, 1, "active"],
      [4, "Production", "Production", 4, 1, "active"],
      [5, "Production", "Production (omega)", 5, 1, "active"],
      [6, "Post-production", "Post-production", 6, 1, "active"],
      [7, "Completed", "FINAL OK – completed", 7, 1, "done"],
      [8, "Closed", "Closed (soft-lock)", 8, 1, "closed"],
      [9, "Invoiced", "Invoiced (read-only)", 9, 1, "invoiced"],
      [10, "Archived", "Archived", 10, 1, "arch"],
      [11, "On hold", "On hold", 11, 1, "arch"],
      [12, "Cancelled", "Cancelled", 12, 1, "cancelled"],
    ];
    const [existingSp] = await conn.query("SELECT 1 FROM statusi_projekta LIMIT 1");
    if (existingSp.length === 0) {
      const values = fullStatusiProjekta
        .map(([id, naziv, opis, red, akt, core]) => `(${id}, ${conn.escape(naziv)}, ${conn.escape(opis)}, ${red}, ${akt}, ${conn.escape(core)})`)
        .join(",\n        ");
      await conn.query(`
        INSERT INTO statusi_projekta (status_id, naziv_statusa, opis, redoslijed, aktivan, core_faza) VALUES
        ${values}
      `);
      console.log("  + statusi_projekta (12 reda)");
    } else {
      // Demo baza možda ima samo 1,2,3 – dopuni do 12 da FINAL OK / Close rade
      const [ids] = await conn.query("SELECT status_id FROM statusi_projekta");
      const existingIds = new Set((ids || []).map((r) => Number(r.status_id)));
      const toInsert = fullStatusiProjekta.filter(([id]) => !existingIds.has(id));
      if (toInsert.length > 0) {
        const values = toInsert
          .map(([id, naziv, opis, red, akt, core]) => `(${id}, ${conn.escape(naziv)}, ${conn.escape(opis)}, ${red}, ${akt}, ${conn.escape(core)})`)
          .join(",\n        ");
        await conn.query(`
          INSERT INTO statusi_projekta (status_id, naziv_statusa, opis, redoslijed, aktivan, core_faza) VALUES
          ${values}
        `);
        console.log("  + statusi_projekta dopunjeno za status_id: " + toInsert.map(([id]) => id).join(", "));
      }
    }

    // ----- projekt_statusi (API project-statuses) – ista 12 kao statusi_projekta -----
    const fullProjektStatusi = [
      [1, "open", "Open", null, 1, 1],
      [2, "in_progress", "In progress", null, 2, 2],
      [3, "service", "Service", null, 3, 3],
      [4, "production", "Production", null, 4, 4],
      [5, "production_omega", "Production", null, 5, 5],
      [6, "post_production", "Post-production", null, 6, 6],
      [7, "completed", "Completed", null, 7, 7],
      [8, "closed_soft", "Closed", null, 8, 8],
      [9, "invoiced", "Invoiced", null, 9, 9],
      [10, "archived", "Archived", null, 10, 10],
      [11, "on_hold", "On hold", null, 11, 11],
      [12, "cancelled", "Cancelled", null, 12, 12],
    ];
    const [existingPs] = await conn.query("SELECT 1 FROM projekt_statusi LIMIT 1");
    if (existingPs.length === 0) {
      const psValues = fullProjektStatusi
        .map(([id, kod, naziv, opis, sort, red]) => `(${id}, ${conn.escape(kod)}, ${conn.escape(naziv)}, ${opis == null ? "NULL" : conn.escape(opis)}, ${sort}, ${red})`)
        .join(",\n        ");
      await conn.query(`
        INSERT INTO projekt_statusi (status_id, kod, naziv, opis, sort, redoslijed) VALUES
        ${psValues}
      `);
      console.log("  + projekt_statusi (12 reda)");
    } else {
      const [psIds] = await conn.query("SELECT status_id FROM projekt_statusi");
      const existingPsIds = new Set((psIds || []).map((r) => Number(r.status_id)));
      const toInsertPs = fullProjektStatusi.filter(([id]) => !existingPsIds.has(id));
      if (toInsertPs.length > 0) {
        const psValues = toInsertPs
          .map(([id, kod, naziv, opis, sort, red]) => `(${id}, ${conn.escape(kod)}, ${conn.escape(naziv)}, ${opis == null ? "NULL" : conn.escape(opis)}, ${sort}, ${red})`)
          .join(",\n        ");
        await conn.query(`
          INSERT INTO projekt_statusi (status_id, kod, naziv, opis, sort, redoslijed) VALUES
          ${psValues}
        `);
        console.log("  + projekt_statusi dopunjeno za status_id: " + toInsertPs.map(([id]) => id).join(", "));
      }
    }

    // ----- roles + demo user (za login "Pogledaj demo") -----
    try {
      const [hasRoles] = await conn.query("SELECT 1 FROM roles LIMIT 1");
      if (hasRoles.length === 0) {
        const nivoCol = await conn.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME IN ('nivo_ovlastenja', 'nivo_ovlascenja') LIMIT 1"
        ).then(([r]) => r[0]?.COLUMN_NAME || "nivo_ovlastenja");
        await conn.query(
          `INSERT INTO roles (naziv, ${nivoCol}) VALUES ('Demo', 10)`
        );
        console.log("  + roles (1 red: Demo, nivo 10)");
      }
      const [roleRow] = await conn.query("SELECT role_id FROM roles ORDER BY role_id LIMIT 1");
      const roleId = roleRow[0]?.role_id ?? 1;
      const hash = await bcrypt.hash("demo", 10);
      const [demoUser] = await conn.query(
        "SELECT user_id FROM users WHERE username = 'demo' LIMIT 1"
      );
      if (demoUser.length === 0) {
        try {
          await conn.query(
            `INSERT INTO users (username, password_hash, role_id, aktivan) VALUES (?, ?, ?, 1)`,
            ["demo", hash, roleId]
          );
        } catch (e) {
          if (String(e?.message || e).includes("password_hash") || String(e?.message || e).includes("Unknown column")) {
            await conn.query(
              `INSERT INTO users (username, password, role_id, aktivan) VALUES (?, ?, ?, 1)`,
              ["demo", hash, roleId]
            );
          } else throw e;
        }
        console.log("  + users (demo / demo)");
      } else {
        try {
          await conn.query(
            "UPDATE users SET password_hash = ?, role_id = ?, aktivan = 1 WHERE username = 'demo'",
            [hash, roleId]
          );
        } catch (e) {
          if (String(e?.message || e).includes("password_hash") || String(e?.message || e).includes("Unknown column")) {
            await conn.query(
              "UPDATE users SET password = ?, role_id = ?, aktivan = 1 WHERE username = 'demo'",
              [hash, roleId]
            );
          } else throw e;
        }
        console.log("  ~ users (demo / demo – lozinka ažurirana)");
      }
    } catch (e) {
      console.warn("  ! Preskačem roles/users (tabela ili kolone nedostaju):", e?.message || e);
    }

    // ----- statusi (za inicijacije/deals) -----
    try {
      const [hasNovo] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='novo' LIMIT 1",
      );
      if (!hasNovo.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'novo', 'New', 1, 1)`,
        );
        console.log("  + statusi inicijacija: novo");
      }

      const [hasOtvorena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='otvorena' LIMIT 1",
      );
      if (!hasOtvorena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'otvorena', 'Open', 2, 1)`,
        );
      }
      const [hasDobijena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='dobijena' LIMIT 1",
      );
      if (!hasDobijena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'dobijena', 'Won', 3, 1)`,
        );
      }
      const [hasIzgubljena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='izgubljena' LIMIT 1",
      );
      if (!hasIzgubljena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'izgubljena', 'Lost', 4, 1)`,
        );
      }
      console.log("  + statusi inicijacija (New/Open/Won/Lost) ensured");
    } catch (e) {
      console.warn("  ! Preskačem seed statusa inicijacija (tabela/kolone se razlikuju):", e?.message || e);
    }

    // ----- klijenti (više za dobar demo prikaz) -----
    const [existingK] = await conn.query("SELECT 1 FROM klijenti LIMIT 1");
    if (existingK.length === 0) {
      await conn.query(`
        INSERT INTO klijenti (naziv_klijenta, tip_klijenta, adresa, grad, drzava, email, rok_placanja_dana, aktivan) VALUES
        ('Acme Media Ltd', 'direktni', 'Broadway 12', 'London', 'UK', 'contact@acme-media.eu', 14, 1),
        ('Nordic Agency AB', 'agencija', 'Storgatan 5', 'Stockholm', 'SE', 'hello@nordic-agency.eu', 30, 1),
        ('Delta Client GmbH', 'direktni', 'Friedrichstraße 44', 'Berlin', 'DE', 'info@delta-client.com', 30, 1),
        ('Retail Partners SA', 'direktni', 'Rue de Commerce 8', 'Paris', 'FR', 'orders@retail-a.eu', 15, 1),
        ('Trade Co d.o.o.', 'direktni', 'Ilica 22', 'Zagreb', 'HR', 'sales@retail-b.hr', 20, 1),
        ('Iberia Brands SL', 'direktni', 'Gran Vía 100', 'Madrid', 'ES', 'info@iberia-brands.eu', 21, 1),
        ('Alpine Events GmbH', 'agencija', 'Kärntner Straße 18', 'Vienna', 'AT', 'hello@alpine-events.eu', 30, 1),
        ('Lowlands BV', 'direktni', 'Damrak 42', 'Amsterdam', 'NL', 'contact@lowlands.nl', 14, 1),
        ('Celtic Media Ltd', 'direktni', 'Grafton Street 5', 'Dublin', 'IE', 'hello@celtic-media.eu', 30, 1)
      `);
      console.log("  + klijenti (9)");
    }

    // ----- projekti (više, različiti statusi za dobar prikaz) -----
    const [klijentIds] = await conn.query("SELECT klijent_id FROM klijenti ORDER BY klijent_id LIMIT 9");
    const [projCount] = await conn.query("SELECT COUNT(*) AS c FROM projekti");
    if (projCount[0].c === 0 && klijentIds.length > 0) {
      const k = (i) => klijentIds[Math.min(i, klijentIds.length - 1)].klijent_id;
      await conn.query(
        `
        INSERT INTO projekti (narucilac_id, radni_naziv, naziv_za_fakturu, status_id, rok_glavni, budzet_planirani, is_test) VALUES
        (?, 'Spring campaign 2026', 'Spring campaign 2026', 1, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 15000.00, 1),
        (?, 'Brand X spot', 'Brand X spot', 2, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 8000.00, 1),
        (?, 'Event sponsorship', 'Event sponsorship', 1, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 25000.00, 1),
        (?, 'Product launch video', 'Product launch video', 4, DATE_ADD(CURDATE(), INTERVAL 21 DAY), 12000.00, 1),
        (?, 'Documentary series', 'Documentary series', 3, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 45000.00, 1),
        (?, 'Social ads package', 'Social ads package', 2, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 5500.00, 1),
        (?, 'Corporate rebrand', 'Corporate rebrand', 1, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 32000.00, 1),
        (?, 'Podcast studio setup', 'Podcast studio setup', 5, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 9800.00, 1)
      `,
        [k(0), k(1), k(0), k(2), k(3), k(4), k(5), k(6)]
      );
      console.log("  + projekti (8)");
    }
    // Osiguraj barem 1 projekat označen kao demo (za fakture/deal povezivanja)
    let demoProjectId = null;
    try {
      const [demoProj] = await conn.query(
        "SELECT projekat_id FROM projekti WHERE is_test = 1 ORDER BY projekat_id ASC LIMIT 1",
      );
      if (demoProj?.[0]?.projekat_id) demoProjectId = Number(demoProj[0].projekat_id);
    } catch {}

    // ----- talenti (više imena za dobar prikaz) -----
    const [talCount] = await conn.query("SELECT COUNT(*) AS c FROM talenti");
    if (talCount[0].c === 0) {
      await conn.query(`
        INSERT INTO talenti (ime_prezime, vrsta, email, aktivan) VALUES
        ('John Smith', 'spiker', 'john.smith@talent.eu', 1),
        ('Oleg Petrov', 'glumac', 'oleg.petrov@talent.eu', 1),
        ('Pete Jones', 'muzicar', 'pete.jones@talent.eu', 1),
        ('Marie Dubois', 'montazer', 'marie.dubois@talent.eu', 1),
        ('Hans Weber', 'kamera', 'hans.weber@talent.eu', 1),
        ('Anna Kowalski', 'glumac', 'anna.kowalski@talent.eu', 1),
        ('Marco Rossi', 'spiker', 'marco.rossi@talent.eu', 1),
        ('Elena Vasquez', 'kamera', 'elena.vasquez@talent.eu', 1),
        ('James O\'Brien', 'muzicar', 'james.obrien@talent.eu', 1),
        ('Sophie Müller', 'montazer', 'sophie.mueller@talent.eu', 1)
      `);
      console.log("  + talenti (10)");
    }

    // ----- dobavljaci -----
    const [dobCount] = await conn.query("SELECT COUNT(*) AS c FROM dobavljaci");
    if (dobCount[0].c === 0) {
      await conn.query(`
        INSERT INTO dobavljaci (naziv, vrsta, pravno_lice, grad, email, aktivan) VALUES
        ('Studio One GmbH', 'studio', 1, 'Munich', 'studio@studio-one.eu', 1),
        ('Freelance Pro', 'freelancer', 0, 'Amsterdam', 'contact@freelance-pro.eu', 1),
        ('Rental House Ltd', 'studio', 1, 'London', 'gear@rental-house.co.uk', 1),
        ('Post Studio Paris', 'studio', 1, 'Paris', 'contact@poststudio.eu', 1),
        ('Sound & Light BV', 'freelancer', 0, 'Rotterdam', 'info@soundlight.eu', 1)
      `);
      console.log("  + dobavljaci (5)");
    }

    // ----- radne_faze (opciono, za fazne prikaze) -----
    const [fazeCount] = await conn.query("SELECT COUNT(*) AS c FROM radne_faze");
    if (fazeCount[0].c === 0) {
      await conn.query(`
        INSERT INTO radne_faze (naziv, opis_poslova, vrsta_posla, aktivna) VALUES
        ('Pre-production', 'Prep and planning', 'produkcija', 1),
        ('Production', 'Shoot', 'produkcija', 1),
        ('Post-production', 'Edit and delivery', 'produkcija', 1)
      `);
      console.log("  + radne_faze (3)");
    }

    // ----- cjenovnik_stavke (opciono) -----
    const [cjenCount] = await conn.query("SELECT COUNT(*) AS c FROM cjenovnik_stavke");
    if (cjenCount[0].c === 0) {
      await conn.query(`
        INSERT INTO cjenovnik_stavke (naziv, jedinica, cijena_default, valuta_default, sort_order, active) VALUES
        ('Hourly rate', 'SAT', 75.00, 'EUR', 100, 1),
        ('Day rate', 'DAN', 550.00, 'EUR', 200, 1),
        ('Per unit', 'KOM', 120.00, 'EUR', 300, 1)
      `);
      console.log("  + cjenovnik_stavke (3)");
    }

    // ----- tip_troska (tipovi troškova za dropdown "Tip + entitet") -----
    // Uvijek postavimo 3 tipa (REPLACE nadjačava ako već postoje), da demo ima Honorar/Ostalo/Firma
    try {
      await conn.query(`
        REPLACE INTO tip_troska (tip_id, naziv, requires_entity, aktivan) VALUES
        (1, 'Honorar', 'TALENT', 1),
        (2, 'Ostalo', 'NONE', 1),
        (3, 'Firma', 'VENDOR', 1)
      `);
      console.log("  + tip_troska (Honorar, Ostalo, Firma)");
    } catch (e) {
      console.warn("  ! Preskačem tip_troska seed:", e?.message || e);
    }

    // ----- projektni_troskovi (primjeri troškova na prvim projektima) -----
    try {
      const [costCount] = await conn.query("SELECT COUNT(*) AS c FROM projektni_troskovi");
      if (costCount[0].c === 0) {
        const [projRows] = await conn.query(
          "SELECT projekat_id FROM projekti ORDER BY projekat_id ASC LIMIT 3",
        );
        const [talentRows] = await conn.query("SELECT talent_id FROM talenti ORDER BY talent_id ASC LIMIT 1");
        const [dobRows] = await conn.query("SELECT dobavljac_id FROM dobavljaci ORDER BY dobavljac_id ASC LIMIT 1");
        const pid1 = projRows?.[0]?.projekat_id ? Number(projRows[0].projekat_id) : null;
        const pid2 = projRows?.[1]?.projekat_id ? Number(projRows[1].projekat_id) : null;
        const talentId = talentRows?.[0]?.talent_id ? Number(talentRows[0].talent_id) : null;
        const dobId = dobRows?.[0]?.dobavljac_id ? Number(dobRows[0].dobavljac_id) : null;
        const today = new Date().toISOString().slice(0, 10);
        const tipId = 1;

        if (pid1) {
          await conn.query(
            `
            INSERT INTO projektni_troskovi (projekat_id, tip_id, datum_troska, opis, iznos_km, status)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [pid1, tipId, today, "Demo seed: production day (catering)", 450.0, "NASTALO"],
          );
          await conn.query(
            `
            INSERT INTO projektni_troskovi (projekat_id, tip_id, datum_troska, opis, iznos_km, status)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [pid1, tipId, today, "Demo seed: equipment rental", 320.0, "NASTALO"],
          );
        }
        if (pid2) {
          await conn.query(
            `
            INSERT INTO projektni_troskovi (projekat_id, tip_id, datum_troska, opis, iznos_km, status)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [pid2, tipId, today, "Demo seed: talent fee", 600.0, "NASTALO"],
          );
        }
        // Jedan trošak s entity (talent ili dobavljač) ako kolone postoje
        if (pid1 && (talentId != null || dobId != null)) {
          try {
            await conn.query(
              `
              INSERT INTO projektni_troskovi
                (projekat_id, tip_id, datum_troska, opis, iznos_km, status, entity_type, entity_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                pid1,
                tipId,
                today,
                talentId != null ? "Demo seed: talent (John Smith)" : "Demo seed: vendor (Studio One)",
                350.0,
                "NASTALO",
                talentId != null ? "talent" : "vendor",
                talentId != null ? talentId : dobId,
              ],
            );
          } catch (e) {
            // Kolone entity_type/entity_id možda ne postoje
          }
        }
        console.log("  + projektni_troskovi (demo primjeri)");
      }
    } catch (e) {
      console.warn("  ! Preskačem projektni_troskovi seed:", e?.message || e);
    }

    // ==========================================================
    // DODATNI DEMO PODACI: deal-ovi (inicijacije), 2 fakture, 1 izvod
    // ==========================================================

    // ----- inicijacije (2 deal-a) -----
    try {
      const [sidRows] = await conn.query(
        "SELECT status_id FROM statusi WHERE entitet='inicijacija' AND kod='novo' LIMIT 1",
      );
      const statusNovoId = sidRows?.[0]?.status_id ? Number(sidRows[0].status_id) : null;
      const narucilacId = klijentIds?.[0]?.klijent_id ? Number(klijentIds[0].klijent_id) : null;

      if (statusNovoId && narucilacId) {
        const [hasDeals] = await conn.query(
          "SELECT 1 FROM inicijacije WHERE napomena LIKE ? LIMIT 1",
          [`%${seedTag}%`],
        );
        if (!hasDeals.length) {
          const k2 = klijentIds?.[1]?.klijent_id ?? narucilacId;
          const k3 = klijentIds?.[2]?.klijent_id ?? narucilacId;
          const k4 = klijentIds?.[3]?.klijent_id ?? narucilacId;
          const k5 = klijentIds?.[4]?.klijent_id ?? narucilacId;
          await conn.query(
            `
            INSERT INTO inicijacije
              (narucilac_id, krajnji_klijent_id, radni_naziv, kontakt_ime, kontakt_tel, kontakt_email, napomena, status_id)
            VALUES
              (?, NULL, 'Demo deal #1 — spring campaign', 'John Smith', '+44 20 7946 0958', 'john.smith@acme-media.eu', ?, ?),
              (?, NULL, 'Demo deal #2 — rebrand package', 'Oleg Petrov', '+1 212 555 0147', 'oleg.petrov@delta-client.com', ?, ?),
              (?, NULL, 'Demo deal #3 — product launch', 'Anna Berg', '+46 8 123 4567', 'anna.berg@nordic-agency.eu', ?, ?),
              (?, NULL, 'Demo deal #4 — documentary', 'Pierre Martin', '+33 1 42 86 8300', 'pierre.martin@retail-a.eu', ?, ?),
              (?, NULL, 'Demo deal #5 — social campaign', 'Lisa Weber', '+49 30 12345678', 'lisa.weber@delta-client.com', ?, ?)
            `,
            [
              narucilacId, `${seedTag}: inicijacija 1`, statusNovoId,
              narucilacId, `${seedTag}: inicijacija 2`, statusNovoId,
              k2, `${seedTag}: inicijacija 3`, statusNovoId,
              k3, `${seedTag}: inicijacija 4`, statusNovoId,
              k4, `${seedTag}: inicijacija 5`, statusNovoId,
            ],
          );
          console.log("  + inicijacije (5)");
        }
      }
    } catch (e) {
      console.warn("  ! Preskačem inicijacije seed:", e?.message || e);
    }

    // ----- fakture (2) + faktura_projekti link -----
    try {
      // izaberi jedan projekat i naručioca
      const [pRow] = await conn.query(
        `
        SELECT p.projekat_id, p.narucilac_id
        FROM projekti p
        WHERE p.narucilac_id IS NOT NULL
        ORDER BY p.projekat_id ASC
        LIMIT 1
        `,
      );
      const projekatId = pRow?.[0]?.projekat_id ? Number(pRow[0].projekat_id) : demoProjectId;
      const billTo = pRow?.[0]?.narucilac_id ? Number(pRow[0].narucilac_id) : (klijentIds?.[0]?.klijent_id ? Number(klijentIds[0].klijent_id) : null);

      if (projekatId && billTo) {
        const year = new Date().getFullYear();
        const [hasInv] = await conn.query(
          "SELECT 1 FROM fakture WHERE poziv_na_broj IN ('77112233','88445566') LIMIT 1",
        );
        if (!hasInv.length) {
          // odredi sljedeći broj_u_godini
          const [lastNo] = await conn.query(
            "SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?",
            [year],
          );
          const start = Number(lastNo?.[0]?.m ?? 0) + 1;
          const today = new Date().toISOString().slice(0, 10);

          // faktura 1
          const [ins1] = await conn.query(
            `
            INSERT INTO fakture
              (bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni, fiskalni_status,
               datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
               pdv_obracunat, iznos_ukupno_km, poziv_na_broj)
            VALUES
              (?, ?, ?, ?, 'DODIJELJEN', ?, 'obicna', 'EUR', ?, 20.0, ?, 1, ?, ?)
            `,
            [billTo, year, start, 9001 + start, today, 1000.0, 200.0, 1200.0, "77112233"],
          );
          const faktura1Id = Number(ins1?.insertId);
          if (faktura1Id) {
            try {
              await conn.query(
                `INSERT INTO faktura_projekti (faktura_id, projekat_id, opisne_stavke, naziv_na_fakturi)
                 VALUES (?, ?, ?, ?)`,
                [
                  faktura1Id,
                  projekatId,
                  JSON.stringify(["Video production", "Post-production and graphics"]),
                  "Spring campaign 2026",
                ],
              );
            } catch (e) {
              // fallback ako kolone ne postoje
              await conn.query(
                `INSERT INTO faktura_projekti (faktura_id, projekat_id) VALUES (?, ?)`,
                [faktura1Id, projekatId],
              );
            }
          }

          // faktura 2
          const [ins2] = await conn.query(
            `
            INSERT INTO fakture
              (bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni, fiskalni_status,
               datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
               pdv_obracunat, iznos_ukupno_km, poziv_na_broj)
            VALUES
              (?, ?, ?, ?, 'DODIJELJEN', ?, 'obicna', 'EUR', ?, 0.0, 0.0, 0, ?, ?)
            `,
            [billTo, year, start + 1, 9001 + start + 1, today, 850.0, 850.0, "88445566"],
          );
          const faktura2Id = Number(ins2?.insertId);
          if (faktura2Id) {
            try {
              await conn.query(
                `INSERT INTO faktura_projekti (faktura_id, projekat_id, opisne_stavke, naziv_na_fakturi)
                 VALUES (?, ?, ?, ?)`,
                [
                  faktura2Id,
                  projekatId,
                  JSON.stringify(["Creative and copy", "Format adaptations"]),
                  "Spring campaign 2026 (EUR)",
                ],
              );
            } catch (e) {
              await conn.query(
                `INSERT INTO faktura_projekti (faktura_id, projekat_id) VALUES (?, ?)`,
                [faktura2Id, projekatId],
              );
            }
          }

          console.log("  + fakture (2) + faktura_projekti");
        }
      }
    } catch (e) {
      console.warn("  ! Preskačem fakture seed:", e?.message || e);
    }

    // ----- 1 izvod (bank_import_batch) + par transakcija (bank_tx_staging) -----
    try {
      const [hasBatch] = await conn.query(
        `SELECT batch_id FROM bank_import_batch WHERE company_name LIKE ? LIMIT 1`,
        [`%${seedTag}%`],
      );
      if (!hasBatch.length) {
        const statementDate = new Date().toISOString().slice(0, 10);
        const fileHash = `${seedTag}_HASH_${Date.now()}`;
        const [bRes] = await conn.query(
          `
          INSERT INTO bank_import_batch
            (account_id, source, upp_id, bank_account_no, tax_id, company_name,
             statement_no, statement_date, currency,
             opening_balance, closing_balance, total_debit, total_credit, file_hash)
          VALUES
            (?, 'DEMO_SEED', 'UPP-DEMO', 'DE89370400440532013000', 'DE123456789', ?,
             999, ?, 'EUR',
             1000.00, 1015.00, 120.00, 135.00, ?)
          `,
          [1, `Acme Media Ltd (${seedTag})`, statementDate, fileHash],
        );
        const batchId = Number(bRes?.insertId);
        if (batchId) {
          const txs = [
            {
              tx_hash: `${seedTag}_TX_1_${batchId}`,
              reference: "3/00001/1",
              value_date: statementDate,
              amount: -85.0,
              currency: "EUR",
              counterparty: "Bank Fees Ltd",
              counterparty_bank: "Demo Bank AG",
              description: "FX conversion fee",
              full_description: "FX conversion fee | EUR rate 1.05",
              tx_type: 1,
              direction_flag: 1,
              is_fee: 1,
              fee_for_reference: null,
              raw_json: { seed: seedTag, kind: "fee" },
            },
            {
              tx_hash: `${seedTag}_TX_2_${batchId}`,
              reference: "3/00002/1",
              value_date: statementDate,
              amount: 100.0,
              currency: "EUR",
              counterparty: "Retail Partners SA",
              counterparty_bank: "BNP Paribas",
              description: "Payment ref invoice 001",
              full_description: "Payment ref invoice 001 | ref 77112233",
              tx_type: 2,
              direction_flag: 2,
              is_fee: 0,
              fee_for_reference: null,
              raw_json: { seed: seedTag, kind: "in" },
            },
          ];

          for (const tx of txs) {
            await conn.query(
              `
              INSERT INTO bank_tx_staging
                (batch_id, tx_hash, reference, value_date, amount, currency,
                 counterparty, counterparty_bank, description, full_description,
                 tx_type, direction_flag, is_fee, fee_for_reference, status, raw_json)
              VALUES
                (?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ?, 'NEW', CAST(? AS JSON))
              `,
              [
                batchId,
                tx.tx_hash,
                tx.reference,
                tx.value_date,
                tx.amount,
                tx.currency,
                tx.counterparty,
                tx.counterparty_bank,
                tx.description,
                tx.full_description,
                tx.tx_type,
                tx.direction_flag,
                tx.is_fee,
                tx.fee_for_reference,
                JSON.stringify(tx.raw_json),
              ],
            );
          }
          console.log("  + izvod (1) + bank_tx_staging (2 tx)");
        }
      }
    } catch (e) {
      console.warn("  ! Preskačem izvod seed:", e?.message || e);
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("\nSeed završen. Osvježi stranice u aplikaciji (Klijenti, Projekti, Talenti, Dobavljači, Cjenovnik).");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
