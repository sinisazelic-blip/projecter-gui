/**
 * Seed demo baze – ubacuje lažne klijente, projekte, talente, dobavljače i minimalne šifarnike
 * za prikaz u UI-u. Koristi DB_* iz .env.local (postavi DB_NAME=studio_db_demo).
 *
 * Pokretanje: node scripts/seed-demo.js
 * (iz root foldera projekta)
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

    // ----- statusi_projekta (projekti.status_id FK) -----
    const [existingSp] = await conn.query("SELECT 1 FROM statusi_projekta LIMIT 1");
    if (existingSp.length === 0) {
      await conn.query(`
        INSERT INTO statusi_projekta (status_id, naziv_statusa, opis, redoslijed, aktivan, core_faza) VALUES
        (1, 'U pripremi', 'Projekat u pripremi', 1, 1, 'draft'),
        (2, 'Aktivan', 'Projekat u toku', 2, 1, 'active'),
        (3, 'Zatvoren', 'Projekat završen', 3, 1, 'closed')
      `);
      console.log("  + statusi_projekta (3 reda)");
    }

    // ----- projekt_statusi (API project-statuses) -----
    const [existingPs] = await conn.query("SELECT 1 FROM projekt_statusi LIMIT 1");
    if (existingPs.length === 0) {
      await conn.query(`
        INSERT INTO projekt_statusi (status_id, kod, naziv, opis, sort, redoslijed) VALUES
        (1, 'priprema', 'U pripremi', NULL, 1, 1),
        (2, 'aktivan', 'Aktivan', NULL, 2, 2),
        (3, 'zatvoren', 'Zatvoren', NULL, 3, 3)
      `);
      console.log("  + projekt_statusi (3 reda)");
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
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'novo', 'Novo', 1, 1)`,
        );
        console.log("  + statusi inicijacija: novo");
      }

      const [hasOtvorena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='otvorena' LIMIT 1",
      );
      if (!hasOtvorena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'otvorena', 'Otvorena', 2, 1)`,
        );
      }
      const [hasDobijena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='dobijena' LIMIT 1",
      );
      if (!hasDobijena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'dobijena', 'Dobijena', 3, 1)`,
        );
      }
      const [hasIzgubljena] = await conn.query(
        "SELECT 1 FROM statusi WHERE entitet='inicijacija' AND kod='izgubljena' LIMIT 1",
      );
      if (!hasIzgubljena.length) {
        await conn.query(
          `INSERT INTO statusi (entitet, kod, naziv, redoslijed, aktivan) VALUES ('inicijacija', 'izgubljena', 'Izgubljena', 4, 1)`,
        );
      }
      console.log("  + statusi inicijacija (novo/otvorena/dobijena/izgubljena) ensured");
    } catch (e) {
      console.warn("  ! Preskačem seed statusa inicijacija (tabela/kolone se razlikuju):", e?.message || e);
    }

    // ----- klijenti -----
    const [existingK] = await conn.query("SELECT 1 FROM klijenti LIMIT 1");
    if (existingK.length === 0) {
      await conn.query(`
        INSERT INTO klijenti (naziv_klijenta, tip_klijenta, adresa, grad, drzava, email, rok_placanja_dana, aktivan) VALUES
        ('Demo TV d.o.o.', 'direktni', 'Demo ulica 1', 'Sarajevo', 'BiH', 'demo@demo.ba', 14, 1),
        ('Agencija Demo', 'agencija', 'Agencijska 5', 'Mostar', 'BiH', 'agencija@demo.ba', 30, 1),
        ('Ino Client Ltd', 'direktni', 'Foreign St 10', 'London', 'UK', 'ino@demo.com', 30, 1)
      `);
      console.log("  + klijenti (3)");
    }
    // Dodatni fake klijenti (bez dupliranja)
    try {
      const [moreK] = await conn.query(
        "SELECT klijent_id FROM klijenti WHERE email IN ('client.a@demo.ba','client.b@demo.ba') LIMIT 2",
      );
      if (moreK.length < 2) {
        await conn.query(
          `
          INSERT INTO klijenti (naziv_klijenta, tip_klijenta, adresa, grad, drzava, email, rok_placanja_dana, aktivan)
          SELECT * FROM (
            SELECT 'Demo Retail A d.o.o.' AS naziv_klijenta, 'direktni' AS tip_klijenta, 'Market 12' AS adresa, 'Banja Luka' AS grad, 'BiH' AS drzava, 'client.a@demo.ba' AS email, 15 AS rok_placanja_dana, 1 AS aktivan
            UNION ALL
            SELECT 'Demo Retail B d.o.o.', 'direktni', 'Trg 7', 'Tuzla', 'BiH', 'client.b@demo.ba', 20, 1
          ) x
          WHERE NOT EXISTS (SELECT 1 FROM klijenti k WHERE k.email = x.email)
          `,
        );
        console.log("  + klijenti (dodatna 2)");
      }
    } catch {}

    // ----- projekti (narucilac_id, status_id) -----
    const [klijentIds] = await conn.query("SELECT klijent_id FROM klijenti ORDER BY klijent_id LIMIT 3");
    const [projCount] = await conn.query("SELECT COUNT(*) AS c FROM projekti");
    if (projCount[0].c === 0 && klijentIds.length > 0) {
      const k1 = klijentIds[0].klijent_id;
      const k2 = klijentIds[1]?.klijent_id ?? k1;
      await conn.query(
        `
        INSERT INTO projekti (narucilac_id, radni_naziv, naziv_za_fakturu, status_id, rok_glavni, budzet_planirani, is_test) VALUES
        (?, 'Demo kampanja 2026', 'Demo kampanja 2026', 1, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 15000.00, 1),
        (?, 'Spot za brend X', 'Spot za brend X', 2, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 8000.00, 1),
        (?, 'Event pokroviteljstvo', 'Event pokroviteljstvo', 1, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 25000.00, 1)
      `,
        [k1, k2, k1]
      );
      console.log("  + projekti (3)");
    }
    // Osiguraj barem 1 projekat označen kao demo (za fakture/deal povezivanja)
    let demoProjectId = null;
    try {
      const [demoProj] = await conn.query(
        "SELECT projekat_id FROM projekti WHERE is_test = 1 ORDER BY projekat_id ASC LIMIT 1",
      );
      if (demoProj?.[0]?.projekat_id) demoProjectId = Number(demoProj[0].projekat_id);
    } catch {}

    // ----- talenti -----
    const [talCount] = await conn.query("SELECT COUNT(*) AS c FROM talenti");
    if (talCount[0].c === 0) {
      await conn.query(`
        INSERT INTO talenti (ime_prezime, vrsta, email, aktivan) VALUES
        ('Demo Spiker', 'spiker', 'spiker@demo.ba', 1),
        ('Demo Glumac', 'glumac', 'glumac@demo.ba', 1),
        ('Demo Muzičar', 'muzicar', NULL, 1)
      `);
      console.log("  + talenti (3)");
    }
    // Još par talenata (ne dupliraj po emailu)
    try {
      await conn.query(
        `
        INSERT INTO talenti (ime_prezime, vrsta, email, aktivan)
        SELECT * FROM (
          SELECT 'Demo Montažer' AS ime_prezime, 'montazer' AS vrsta, 'montazer@demo.ba' AS email, 1 AS aktivan
          UNION ALL
          SELECT 'Demo Kamera', 'kamera', 'kamera@demo.ba', 1
        ) x
        WHERE NOT EXISTS (SELECT 1 FROM talenti t WHERE t.email = x.email)
        `,
      );
      console.log("  + talenti (dodatna 2)");
    } catch {}

    // ----- dobavljaci -----
    const [dobCount] = await conn.query("SELECT COUNT(*) AS c FROM dobavljaci");
    if (dobCount[0].c === 0) {
      await conn.query(`
        INSERT INTO dobavljaci (naziv, vrsta, pravno_lice, grad, email, aktivan) VALUES
        ('Demo Studio', 'studio', 1, 'Sarajevo', 'studio@demo.ba', 1),
        ('Demo Freelancer', 'freelancer', 0, 'Mostar', 'freelancer@demo.ba', 1)
      `);
      console.log("  + dobavljaci (2)");
    }

    // ----- radne_faze (opciono, za fazne prikaze) -----
    const [fazeCount] = await conn.query("SELECT COUNT(*) AS c FROM radne_faze");
    if (fazeCount[0].c === 0) {
      await conn.query(`
        INSERT INTO radne_faze (naziv, opis_poslova, vrsta_posla, aktivna) VALUES
        ('Preprodukcija', 'Priprema', 'produkcija', 1),
        ('Produkcija', 'Snimanje', 'produkcija', 1),
        ('Postprodukcija', 'Montaža i finalizacija', 'produkcija', 1)
      `);
      console.log("  + radne_faze (3)");
    }

    // ----- cjenovnik_stavke (opciono) -----
    const [cjenCount] = await conn.query("SELECT COUNT(*) AS c FROM cjenovnik_stavke");
    if (cjenCount[0].c === 0) {
      await conn.query(`
        INSERT INTO cjenovnik_stavke (naziv, jedinica, cijena_default, valuta_default, sort_order, active) VALUES
        ('Demo stavka po satu', 'SAT', 50.00, 'BAM', 100, 1),
        ('Demo stavka po danu', 'DAN', 400.00, 'BAM', 200, 1),
        ('Demo stavka komad', 'KOM', 100.00, 'BAM', 300, 1)
      `);
      console.log("  + cjenovnik_stavke (3)");
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
          await conn.query(
            `
            INSERT INTO inicijacije
              (narucilac_id, krajnji_klijent_id, radni_naziv, kontakt_ime, kontakt_tel, kontakt_email, napomena, status_id)
            VALUES
              (?, NULL, 'Demo deal #1 — proljetna kampanja', 'Nina Demo', '+387 65 111 222', 'nina.demo@demo.ba', ?, ?),
              (?, NULL, 'Demo deal #2 — rebranding paket', 'Marko Demo', '+387 65 333 444', 'marko.demo@demo.ba', ?, ?)
            `,
            [
              narucilacId,
              `${seedTag}: inicijacija 1`,
              statusNovoId,
              narucilacId,
              `${seedTag}: inicijacija 2`,
              statusNovoId,
            ],
          );
          console.log("  + inicijacije (2)");
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
              (?, ?, ?, ?, 'DODIJELJEN', ?, 'obicna', 'BAM', ?, 17.0, ?, 1, ?, ?)
            `,
            [billTo, year, start, 9001 + start, today, 1200.0, 204.0, 1404.0, "77112233"],
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
                  JSON.stringify(["Produkcija video spota", "Postprodukcija + grafike"]),
                  "Demo kampanja 2026",
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
                  JSON.stringify(["Kreativa + copy", "Adaptacije formata"]),
                  "Demo kampanja 2026 (EUR)",
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
            (?, 'DEMO_SEED', 'UPP-DEMO', 'BA39DEMO000000000000', '0000000000000', ?,
             999, ?, 'EUR',
             1000.00, 1015.00, 120.00, 135.00, ?)
          `,
          [1, `Studio Demo (${seedTag})`, statementDate, fileHash],
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
              counterparty: "Demo Supplier GmbH",
              counterparty_bank: "DEMO BANK",
              description: "NAKNADA ZA KONVERZIJU",
              full_description: "NAKNADA ZA KONVERZIJU | EUR OPERATIVNI TEČAJ 1.95583",
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
              counterparty: "Demo Client A d.o.o.",
              counterparty_bank: "UNICREDIT DEMO",
              description: "UPLATA PO FAKTURI 001",
              full_description: "Uplata po fakturi (demo) | poziv 77112233",
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
