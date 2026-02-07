// src/app/api/projects/route.js
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

const DEFAULT_STATUS_ID = 3; // Active

function intOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function decOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req) {
  let conn;
  try {
    const url = new URL(req.url);

    // filters
    const q = (url.searchParams.get("q") || "").trim();
    const narId = intOrNull(url.searchParams.get("narucilac_id"));
    const kkId = intOrNull(url.searchParams.get("krajnji_klijent_id"));
    const idPo = intOrNull(url.searchParams.get("id_po"));
    const minBudget = decOrNull(url.searchParams.get("min_budget"));
    const maxBudget = decOrNull(url.searchParams.get("max_budget"));
    const onlyOverBudget = url.searchParams.get("only_over_budget") === "1";

    // status: "all" | "" | "3" | "6" ...
    const statusRaw = url.searchParams.get("status_id");
    const statusMode = (statusRaw || "").toLowerCase();
    const statusId =
      statusRaw === null || statusRaw === undefined || statusRaw === ""
        ? DEFAULT_STATUS_ID
        : statusMode === "all"
          ? null
          : intOrNull(statusRaw);

    // pagination
    const limitRaw = intOrNull(url.searchParams.get("limit")) ?? 50;
    const pageRaw = intOrNull(url.searchParams.get("page")) ?? 1;
    const limit = Math.max(1, Math.min(200, limitRaw));
    const page = Math.max(1, pageRaw);
    const offset = (page - 1) * limit;

    // sort (user-sort), ali MASTER default za active/arhiva
    const sort = (url.searchParams.get("sort") || "projekat_id").toLowerCase();
    const dirParam = (url.searchParams.get("dir") || "").toLowerCase();
    const dir = dirParam === "asc" || dirParam === "desc" ? dirParam.toUpperCase() : "DESC";

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === "1" ? { rejectUnauthorized: false } : undefined,
      multipleStatements: false,

      // ✅ DATETIME kao string (timezone safe)
      dateStrings: true,
    });

    /**
     * ✅ Budžet source-of-truth (po MC):
     * vf (kanonski iz view-a) → ps (zadnji snapshot) → p (legacy)
     */
    const budgetExpr = "COALESCE(vf.budzet_planirani, p.budzet_planirani, 0)";
    const costsExpr = "COALESCE(vf.troskovi_ukupno, tc.troskovi_ukupno, 0)";

    const where = [];
    const params = [];

    if (narId !== null) {
      where.push("p.narucilac_id = ?");
      params.push(narId);
    }
    if (kkId !== null) {
      where.push("p.krajnji_klijent_id = ?");
      params.push(kkId);
    }
    if (idPo !== null) {
      where.push("p.id_po = ?");
      params.push(idPo);
    }

    if (minBudget !== null) {
      where.push(`${budgetExpr} >= ?`);
      params.push(minBudget);
    }
    if (maxBudget !== null) {
      where.push(`${budgetExpr} <= ?`);
      params.push(maxBudget);
    }
    if (onlyOverBudget) {
      where.push(`${costsExpr} > ${budgetExpr}`);
    }

    if (statusId !== null && Number.isFinite(statusId)) {
      where.push("p.status_id = ?");
      params.push(statusId);
    }

    if (q) {
      const qNum = intOrNull(q);
      if (qNum !== null) {
        where.push("(p.projekat_id = ? OR p.id_po = ? OR p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)");
        params.push(qNum, qNum, `%${q}%`, `%${q}%`);
      } else {
        where.push("(p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // MASTER DEFAULT ORDER (ako user nije eksplicitno sortirao)
    const userExplicitSort = url.searchParams.has("sort") || url.searchParams.has("dir");

    let orderClause = "";
    if (!userExplicitSort && String(statusId) === "3") {
      orderClause = `
        ORDER BY
          CASE WHEN p.rok_glavni IS NULL THEN 1 ELSE 0 END ASC,
          p.rok_glavni ASC,
          p.projekat_id ASC
      `;
    } else if (!userExplicitSort && String(statusId) === "6") {
      orderClause = `ORDER BY p.projekat_id ASC`;
    } else {
      const sortMap = {
        projekat_id: "p.projekat_id",
        id_po: "p.id_po",
        naziv: "p.radni_naziv",
        budzet: budgetExpr,
        troskovi: costsExpr,
        rok: "p.rok_glavni",
        rok_glavni: "p.rok_glavni",
      };
      const orderBy = sortMap[sort] || "p.projekat_id";
      orderClause = `ORDER BY ${orderBy} ${dir}`;
    }

    /**
     * ✅ ps = budžet iz ZADNJEG snapshot-a
     * (ne smije biti SUM svih snapshotova)
     */
    const psJoin = `
      LEFT JOIN (
        SELECT
          x.projekat_id,
          ROUND(SUM(i.line_total), 2) AS budzet_planirani
        FROM (
          SELECT projekat_id, MAX(snapshot_id) AS snapshot_id
          FROM projekat_budget_snapshots
          GROUP BY projekat_id
        ) x
        JOIN projekat_stavke i
          ON i.projekat_id = x.projekat_id AND i.snapshot_id = x.snapshot_id
        GROUP BY x.projekat_id
      ) ps ON ps.projekat_id = p.projekat_id
    `;

    // COUNT
    const [countRows] = await conn.execute(
      `
      SELECT COUNT(*) AS total
      FROM projekti p
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      ${psJoin}
      LEFT JOIN (
        SELECT projekat_id, ROUND(SUM(iznos_km), 2) AS troskovi_ukupno
        FROM projektni_troskovi
        WHERE status <> 'STORNIRANO'
        GROUP BY projekat_id
      ) tc ON tc.projekat_id = p.projekat_id
      ${whereSql}
      `,
      params
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const safeOffset = Number.isFinite(offset) ? offset : 0;
    const safeLimit = Number.isFinite(limit) ? limit : 50;

    // ROWS
    const [rows] = await conn.query(
      `
      SELECT
        p.projekat_id,
        p.id_po,
        p.radni_naziv,
        p.naziv_za_fakturu,
        p.narucilac_id,
        p.krajnji_klijent_id,
        p.status_id,

        p.operativni_signal,

        -- ✅ Rok kao STRING (timezone safe)
        DATE_FORMAT(p.rok_glavni, '%Y-%m-%d %H:%i:%s') AS rok_glavni,
        p.tip_roka,

        -- ✅ Budžet: view → zadnji snapshot → legacy
        ${budgetExpr} AS budzet_planirani,

        -- ✅ Troškovi: view → real costs
        ${costsExpr} AS troskovi_ukupno,

        COALESCE(vf.troskovi_novi, ${costsExpr}) AS troskovi_novi,
        COALESCE(vf.troskovi_legacy, 0) AS troskovi_legacy,
        COALESCE(vf.legacy_flag, 0) AS legacy_flag,

        COALESCE(
          vf.planirana_zarada,
          ( ${budgetExpr} - ${costsExpr} )
        ) AS planirana_zarada,

        COALESCE(
          vf.finansijski_status,
          CASE
            WHEN ${budgetExpr} <= 0 THEN 'bez_budzeta'
            WHEN ( ${budgetExpr} - ${costsExpr} ) >= 0 THEN 'u_plusu'
            ELSE 'u_minusu'
          END
        ) AS finansijski_status

      FROM projekti p
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      ${psJoin}
      LEFT JOIN (
        SELECT projekat_id, ROUND(SUM(iznos_km), 2) AS troskovi_ukupno
        FROM projektni_troskovi
        WHERE status <> 'STORNIRANO'
        GROUP BY projekat_id
      ) tc ON tc.projekat_id = p.projekat_id

      ${whereSql}
      ${orderClause}
      LIMIT ${safeOffset}, ${safeLimit}
      `,
      params
    );

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total,
      rows,
      meta: { default_status_id: DEFAULT_STATUS_ID },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err?.message || "Greška na serveru" }, { status: 500 });
  } finally {
    if (conn) await conn.end();
  }
}
