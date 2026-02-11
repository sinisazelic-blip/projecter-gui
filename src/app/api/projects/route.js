// src/app/api/projects/route.js
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// ✅ DEFAULT: aktivna grupa (1–8)
const DEFAULT_STATUS_GROUP = "active";

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

    // ✅ NEW: status group (active/archive/all) + exact status_id
    const statusGroupRaw = (url.searchParams.get("status_group") || "")
      .trim()
      .toLowerCase();
    const status_group =
      statusGroupRaw === "active" ||
      statusGroupRaw === "archive" ||
      statusGroupRaw === "all"
        ? statusGroupRaw
        : DEFAULT_STATUS_GROUP;

    const status_id = intOrNull(url.searchParams.get("status_id")); // exact filter (optional)

    // pagination
    const limitRaw = intOrNull(url.searchParams.get("limit")) ?? 50;
    const pageRaw = intOrNull(url.searchParams.get("page")) ?? 1;
    const limit = Math.max(1, Math.min(200, limitRaw));
    const page = Math.max(1, pageRaw);
    const offset = (page - 1) * limit;

    // sort (user-sort), ali MASTER default za active/arhiva
    const sort = (url.searchParams.get("sort") || "projekat_id").toLowerCase();
    const dirParam = (url.searchParams.get("dir") || "").toLowerCase();
    const dir =
      dirParam === "asc" || dirParam === "desc"
        ? dirParam.toUpperCase()
        : "DESC";

    /**
     * ✅ Budžet source-of-truth (po MC):
     * vf (kanonski iz view-a) → legacy (p.budzet_planirani)
     * (ps snapshot join ostaje ako ga želiš kasnije uključiti — sada ne diramo)
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

    // ✅ STATUS FILTERING (KANON):
    // - ako je status_id (exact) dat → tačno taj status
    // - inače koristimo status_group:
    //   active  => 1–8
    //   archive => 10 (Arhiviran)
    //   all     => bez filtera
    if (status_id !== null) {
      where.push("p.status_id = ?");
      params.push(status_id);
    } else if (status_group === "active") {
      where.push("p.status_id BETWEEN 1 AND 8");
    } else if (status_group === "archive") {
      where.push("p.status_id = 10");
    } else {
      // all => no filter
    }

    if (q) {
      const qNum = intOrNull(q);
      if (qNum !== null) {
        where.push(
          "(p.projekat_id = ? OR p.id_po = ? OR p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)",
        );
        params.push(qNum, qNum, `%${q}%`, `%${q}%`);
      } else {
        where.push("(p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // MASTER DEFAULT ORDER (ako user nije eksplicitno sortirao)
    const userExplicitSort =
      url.searchParams.has("sort") || url.searchParams.has("dir");

    let orderClause = "";
    if (!userExplicitSort && status_id === null && status_group === "active") {
      orderClause = `
        ORDER BY
          CASE WHEN p.rok_glavni IS NULL THEN 1 ELSE 0 END ASC,
          p.rok_glavni ASC,
          p.projekat_id ASC
      `;
    } else if (
      !userExplicitSort &&
      status_id === null &&
      status_group === "archive"
    ) {
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
        status: "p.status_id",
      };
      const orderBy = sortMap[sort] || "p.projekat_id";
      orderClause = `ORDER BY ${orderBy} ${dir}`;
    }

    // COUNT
    const countRows = await query(
      `
      SELECT COUNT(*) AS total
      FROM projekti p
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      LEFT JOIN (
        SELECT projekat_id, ROUND(SUM(iznos_km), 2) AS troskovi_ukupno
        FROM projektni_troskovi
        WHERE status <> 'STORNIRANO'
        GROUP BY projekat_id
      ) tc ON tc.projekat_id = p.projekat_id
      JOIN statusi_projekta sp ON sp.status_id = p.status_id
      ${whereSql}
      `,
      params,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const safeOffset = Number.isFinite(offset) ? offset : 0;
    const safeLimit = Number.isFinite(limit) ? limit : 50;

    // ROWS
    const rows = await query(
      `
      SELECT
        p.projekat_id,
        p.id_po,
        p.radni_naziv,
        p.naziv_za_fakturu,
        p.narucilac_id,
        p.krajnji_klijent_id,

        -- ✅ KANON STATUS:
        p.status_id,
        sp.naziv_statusa AS status_name,
        sp.core_faza,

        p.operativni_signal,

        -- ✅ Rok kao STRING (timezone safe)
        DATE_FORMAT(p.rok_glavni, '%Y-%m-%d %H:%i:%s') AS rok_glavni,
        p.tip_roka,

        ${budgetExpr} AS budzet_planirani,
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
      LEFT JOIN (
        SELECT projekat_id, ROUND(SUM(iznos_km), 2) AS troskovi_ukupno
        FROM projektni_troskovi
        WHERE status <> 'STORNIRANO'
        GROUP BY projekat_id
      ) tc ON tc.projekat_id = p.projekat_id
      JOIN statusi_projekta sp ON sp.status_id = p.status_id

      ${whereSql}
      ${orderClause}
      LIMIT ${safeOffset}, ${safeLimit}
      `,
      params,
    );

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total,
      rows,
      meta: {
        status_group_default: DEFAULT_STATUS_GROUP,
        status_group,
        status_id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err?.message || "Greška na serveru" },
      { status: 500 },
    );
  }
}
