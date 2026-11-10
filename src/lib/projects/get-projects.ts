import { query } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth/session";

const SARADNIK_NIVO = 0;
const DEFAULT_STATUS_GROUP = "active";

export interface GetProjectsParams {
  q?: string | null;
  narucilac_id?: number | null;
  krajnji_klijent_id?: number | null;
  id_po?: number | null;
  min_budget?: number | null;
  max_budget?: number | null;
  only_over_budget?: boolean;
  status_group?: string | null;
  status_id?: number | null;
  show_storno?: boolean;
  limit?: number | null;
  page?: number | null;
  sort?: string | null;
  dir?: string | null;
}

function intOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function decOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getProjectsList(params: GetProjectsParams, session?: SessionPayload | null) {
  const nivo = session?.nivo ?? 1;
  let radnikId: number | null = null;
  if (session && nivo === SARADNIK_NIVO) {
    const userRows: any = await query(
      "SELECT radnik_id FROM users WHERE user_id = ? LIMIT 1",
      [session.user_id],
    );
    radnikId = userRows?.[0]?.radnik_id != null ? Number(userRows[0].radnik_id) : null;
  }

  const q = (params.q || "").trim();
  const narId = intOrNull(params.narucilac_id);
  const kkId = intOrNull(params.krajnji_klijent_id);
  const idPo = intOrNull(params.id_po);
  const minBudget = decOrNull(params.min_budget);
  const maxBudget = decOrNull(params.max_budget);
  const onlyOverBudget = !!params.only_over_budget;

  const statusGroupRaw = (params.status_group || "").trim().toLowerCase();
  const status_group =
    statusGroupRaw === "active" ||
    statusGroupRaw === "archive" ||
    statusGroupRaw === "all" ||
    statusGroupRaw === "storno"
      ? statusGroupRaw
      : DEFAULT_STATUS_GROUP;

  const status_id = intOrNull(params.status_id);

  const limitRaw = intOrNull(params.limit) ?? 50;
  const pageRaw = intOrNull(params.page) ?? 1;
  const limit = Math.max(1, Math.min(200, limitRaw));
  const page = Math.max(1, pageRaw);
  const offset = (page - 1) * limit;

  const sort = (params.sort || "projekat_id").toLowerCase();
  const dirParam = (params.dir || "").toLowerCase();
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam.toUpperCase() : "DESC";

  const budgetExpr = "COALESCE(ps.budzet_km, vf.budzet_planirani, p.budzet_planirani, 0)";
  const costsExpr = "COALESCE(vf.troskovi_ukupno, tc.troskovi_ukupno, 0)";

  const where: string[] = [];
  const queryParams: any[] = [];

  if (narId !== null) {
    where.push("p.narucilac_id = ?");
    queryParams.push(narId);
  }
  if (kkId !== null) {
    where.push("p.krajnji_klijent_id = ?");
    queryParams.push(kkId);
  }
  if (idPo !== null) {
    where.push("p.id_po = ?");
    queryParams.push(idPo);
  }

  if (minBudget !== null) {
    where.push(`${budgetExpr} >= ?`);
    queryParams.push(minBudget);
  }
  if (maxBudget !== null) {
    where.push(`${budgetExpr} <= ?`);
    queryParams.push(maxBudget);
  }
  if (onlyOverBudget) {
    where.push(`${costsExpr} > ${budgetExpr}`);
  }

  const showStorno = !!params.show_storno;

  if (status_id !== null) {
    where.push("p.status_id = ?");
    queryParams.push(status_id);
  } else if (status_group === "storno") {
    where.push("p.status_id = 12");
  } else if (status_group === "active") {
    where.push("p.status_id BETWEEN 1 AND 7");
  } else if (status_group === "archive") {
    where.push("p.status_id IN (10, 11)");
  }

  if (!showStorno && status_group !== "storno" && status_id !== 12) {
    where.push("p.status_id <> 12");
  }

  if (q) {
    const qNum = intOrNull(q);
    if (qNum !== null) {
      where.push(
        "(p.projekat_id = ? OR p.id_po = ? OR p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)",
      );
      queryParams.push(qNum, qNum, `%${q}%`, `%${q}%`);
    } else {
      where.push("(p.radni_naziv LIKE ? OR p.naziv_za_fakturu LIKE ?)");
      queryParams.push(`%${q}%`, `%${q}%`);
    }
  }

  if (nivo === SARADNIK_NIVO) {
    if (radnikId == null) {
      where.push("1 = 0");
    } else {
      where.push(
        "(p.projekat_id IN (SELECT DISTINCT pf.projekat_id FROM projekat_faze pf INNER JOIN projekat_faza_radnici pfr ON pfr.projekat_faza_id = pf.projekat_faza_id WHERE pfr.radnik_id = ?) OR p.projekat_id IN (SELECT projekat_id FROM projekat_crew WHERE radnik_id = ?))",
      );
      queryParams.push(radnikId, radnikId);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const userExplicitSort = !!params.sort || !!params.dir;
  let orderClause = "";
  if (!userExplicitSort && status_id === null && status_group === "active") {
    orderClause = `
      ORDER BY
        CASE WHEN p.rok_glavni IS NULL THEN 1 ELSE 0 END ASC,
        p.rok_glavni ASC,
        p.projekat_id ASC
    `;
  } else if (!userExplicitSort && status_id === null && status_group === "archive") {
    orderClause = `ORDER BY p.projekat_id ASC`;
  } else {
    const sortMap: Record<string, string> = {
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
  const countRows: any = await query(
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
    queryParams,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const safeOffset = Number.isFinite(offset) ? offset : 0;
  const safeLimit = Number.isFinite(limit) ? limit : 50;

  // ROWS
  const rows: any = await query(
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

      COALESCE(p.budzet_procenat_za_tim, 100.00) AS budzet_procenat_za_tim,

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
    queryParams,
  );

  return {
    ok: true,
    page,
    limit,
    total,
    rows: rows ?? [],
    meta: {
      status_group_default: DEFAULT_STATUS_GROUP,
      status_group,
      status_id,
    },
  };
}
