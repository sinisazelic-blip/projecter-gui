/**
 * Popravka: account_id = firma_bank_accounts (1=UCB, 2=Nova),
 * ne broj izvoda. Mapira se po bank_account_no.
 *
 * Usage: node scripts/_tmp-fix-batch-account-id.cjs [--apply]
 */
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (!v.startsWith('"') && !v.startsWith("'")) {
        const hash = v.indexOf(" #");
        if (hash >= 0) v = v.slice(0, hash).trim();
      }
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] == null) process.env[m[1]] = v.trim();
    }
  }
}

function digits(s) {
  return String(s || "").replace(/\D+/g, "");
}

async function main() {
  const apply = process.argv.includes("--apply");
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:
      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  // Studio firma: UCB=1, Nova=2 (firma_id 3 je prvi Studio unos)
  const [accounts] = await conn.query(
    `SELECT bank_account_id, firma_id, bank_naziv, bank_racun, iban
     FROM firma_bank_accounts
     WHERE firma_id = (
       SELECT firma_id FROM firma_bank_accounts WHERE bank_account_id = 1 LIMIT 1
     )
     ORDER BY bank_account_id`,
  );
  console.log("Accounts (studio):", accounts);

  const ucb = accounts.find((a) =>
    String(a.bank_naziv || "").toLowerCase().includes("unicredit"),
  );
  const nova = accounts.find((a) =>
    String(a.bank_naziv || "").toLowerCase().includes("nova"),
  );
  if (!ucb || !nova) {
    throw new Error("Ne nalazim UCB i Nova u firma_bank_accounts");
  }

  const ucbDigits = new Set(
    [ucb.bank_racun, ucb.iban, "20025811000", "BA393383504857481313"]
      .map(digits)
      .filter((x) => x.length >= 8),
  );
  // XML BAM often stores short form 20025811000
  ucbDigits.add("20025811000");
  ucbDigits.add(digits("BA393383504857481313"));
  ucbDigits.add(digits("3383502257480994"));

  const novaDigits = new Set(
    [nova.bank_racun, "5551000032611271", "555-10000326112-71"]
      .map(digits)
      .filter((x) => x.length >= 8),
  );

  const [batches] = await conn.query(
    `SELECT batch_id, account_id, source, bank_account_no, statement_no, statement_date
     FROM bank_import_batch
     ORDER BY batch_id`,
  );

  const changes = [];
  for (const b of batches) {
    const d = digits(b.bank_account_no);
    let target = null;
    let bank = null;
    if ([...novaDigits].some((nd) => d === nd || d.includes(nd) || nd.includes(d))) {
      target = Number(nova.bank_account_id);
      bank = "Nova";
    } else if (
      [...ucbDigits].some((ud) => d === ud || d.includes(ud) || ud.includes(d))
    ) {
      target = Number(ucb.bank_account_id);
      bank = "UCB";
    } else if (!d) {
      // empty — leave
      continue;
    } else {
      bank = "UNKNOWN";
    }

    const current = b.account_id == null ? null : Number(b.account_id);
    if (target != null && current !== target) {
      changes.push({
        batch_id: b.batch_id,
        from: current,
        to: target,
        bank,
        source: b.source,
        acc: b.bank_account_no,
        statement_no: b.statement_no,
      });
    } else if (target == null) {
      console.warn("UNKNOWN bank_account_no", b);
    }
  }

  console.log(`\nBatches to fix: ${changes.length}`);
  console.log(JSON.stringify(changes.slice(0, 30), null, 2));
  if (changes.length > 30) console.log(`... +${changes.length - 30} more`);

  const byTo = {};
  for (const c of changes) {
    byTo[c.to] = (byTo[c.to] || 0) + 1;
  }
  console.log("Summary by target account_id:", byTo);

  if (!apply) {
    console.log("\nDry-run. Pokreni sa --apply da upiše.");
    await conn.end();
    return;
  }

  await conn.beginTransaction();
  try {
    for (const c of changes) {
      await conn.query(
        `UPDATE bank_import_batch SET account_id = ? WHERE batch_id = ?`,
        [c.to, c.batch_id],
      );
    }
    await conn.commit();
    console.log(`\nUPDATED ${changes.length} batches.`);
  } catch (e) {
    await conn.rollback();
    throw e;
  }

  const [after] = await conn.query(`
    SELECT account_id, COUNT(*) AS n,
           GROUP_CONCAT(DISTINCT source) AS sources,
           GROUP_CONCAT(DISTINCT LEFT(COALESCE(bank_account_no,''), 24) SEPARATOR ' | ') AS accs
    FROM bank_import_batch
    GROUP BY account_id
    ORDER BY account_id
  `);
  console.log("After:", after);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
