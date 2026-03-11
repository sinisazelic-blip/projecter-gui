// src/app/api/projects/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const SARADNIK_NIVO = 0;

// ✅ DEFAULT: aktivna grupa (1–7)
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
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const session = token ? verifySessionToken(token) : null;
    const nivo = session?.nivo ?? 1;
    let radnikId = null;
    if (session && nivo === SARADNIK_NIVO) {
      const userRows = await query(
        "SELECT radnik_id FROM users WHERE user_id = ? LIMIT 1",
        [session.user_id],
      );
      radnikId = userRows?.[0]?.radnik_id != null ? Number(userRows[0].radnik_id) : null;
    }

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
     * ✅ Budžet: prvo staging (projekat_stavke – sync iz Deala), pa view, pa legacy
     * (ista logika kao na stranici detalja projekta)
     */
    const budgetExpr =
      "COALESCE(ps.budzet_km, vf.budzet_planirani, p.budzet_planirani, 0)";
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
    //   active  => 1–7 (bez zatvorenih = 8 i storniranih = 12)
    //   archive => 10 i 11 (Arhiviran + importovani za analizu, bez storniranih = 12)
    //   storno  => samo 12 (Otkazan)
    //   all     => bez filtera (ali po defaultu sakrijemo storno)
    const showStorno = url.searchParams.get("show_storno") === "1";
    
    if (status_id !== null) {
      where.push("p.status_id = ?");
      params.push(status_id);
    } else if (status_group === "storno") {
      where.push("p.status_id = 12");
    } else if (status_group === "active") {
      where.push("p.status_id BETWEEN 1 AND 7");
    } else if (status_group === "archive") {
      where.push("p.status_id IN (10, 11)");
    } else {
      // all => no filter
    }
    
    // ✅ Po defaultu sakrij stornirane projekte (status_id = 12), osim ako eksplicitno tražiš storno
    if (!showStorno && status_group !== "storno" && status_id !== 12) {
      where.push("p.status_id <> 12");
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

    if (nivo === SARADNIK_NIVO) {
      if (radnikId == null) {
        where.push("1 = 0");
      } else {
        where.push(
          "p.projekat_id IN (SELECT DISTINCT pf.projekat_id FROM projekat_faze pf INNER JOIN projekat_faza_radnici pfr ON pfr.projekat_faza_id = pf.projekat_faza_id WHERE pfr.radnik_id = ?)",
        );
        params.push(radnikId);
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

    // Staging join (projekat_stavke, latest snapshot, EUR→BAM) — za budžet u listi
    const EUR_TO_BAM = 1.95583;
    const stagingJoin = `
      LEFT JOIN (
        SELECT ps1.projekat_id,
          ROUND(SUM(
            CASE
              WHEN UPPER(COALESCE(ps1.valuta, 'BAM')) IN ('BAM','KM') THEN COALESCE(ps1.line_total, 0)
              WHEN UPPER(COALESCE(ps1.valuta, '')) = 'EUR' THEN COALESCE(ps1.line_total, 0) * ${EUR_TO_BAM}
              ELSE 0
            END
          ), 2) AS budzet_km
        FROM projekat_stavke ps1
        LEFT JOIN (
          SELECT projekat_id, MAX(IFNULL(snapshot_id, 0)) AS snapshot_id
          FROM projekat_stavke
          GROUP BY projekat_id
        ) ls ON ls.projekat_id = ps1.projekat_id
        WHERE IFNULL(ps1.snapshot_id, 0) = COALESCE(ls.snapshot_id, 0)
        GROUP BY ps1.projekat_id
      ) ps ON ps.projekat_id = p.projekat_id
    `;

    // COUNT
    const countRows = await query(
      `
      SELECT COUNT(*) AS total
      FROM projekti p
      LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
      ${stagingJoin}
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

        -- ✅ NOVO: procenat budžeta vidljiv radnicima (default 100.00)
        COALESCE(p.budzet_procenat_za_tim, 100.00) AS budzet_procenat_za_tim,

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
      ${stagingJoin}
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
    const msg = err?.message || "Greška na serveru";
    return NextResponse.json(
      { ok: false, error: msg, message: msg },
      { status: 500 },
    );
  }
}
