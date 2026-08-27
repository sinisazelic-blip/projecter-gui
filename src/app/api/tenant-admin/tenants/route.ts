import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  calculateEnterSysMonthly,
  ensureEnterSysCjenovnikTable,
  listEnterSysCjenovnik,
} from "@/lib/entersys-cjenovnik";
import { getEnterSysBasePackage, isEnterSysBasePackageId } from "@/lib/entersys-activation";
import {
  normalizeStudioLicenceProfile,
  STUDIO_STUB_NO_FLUXA_PLAN_NAZIV,
} from "@/lib/studio-licence-profile";
import {
  annualMeetStats,
  ensureSoccsMeetsYtdColumns,
} from "@/lib/soccs-meet-quota";

export const dynamic = "force-dynamic";

async function attachAnnualMeetQuota<
  T extends { tenant_id: number; soccs_tier?: string | null },
>(rows: T[]) {
  await ensureSoccsMeetsYtdColumns();
  const ytdById = new Map<
    number,
    { used: number; year: number | null }
  >();
  try {
    const ytdRows = (await query(
      `SELECT tenant_id, soccs_meets_used_ytd, soccs_meets_ytd_year FROM tenants`,
    )) as Array<{
      tenant_id: number;
      soccs_meets_used_ytd: number;
      soccs_meets_ytd_year: number | null;
    }>;
    for (const r of ytdRows ?? []) {
      ytdById.set(Number(r.tenant_id), {
        used: Number(r.soccs_meets_used_ytd ?? 0),
        year:
          r.soccs_meets_ytd_year != null ? Number(r.soccs_meets_ytd_year) : null,
      });
    }
  } catch {
    // kolone još nisu tu
  }

  // Bootstrap: ako YTD nije punjen, procijeni iz CONSUMED MEET kodova u tekućoj godini
  const consumedById = new Map<number, number>();
  try {
    const consumed = (await query(
      `SELECT tenant_id, COUNT(*) AS cnt
       FROM soccs_activation_codes
       WHERE purpose = 'MEET_SESSION'
         AND UPPER(status) = 'CONSUMED'
         AND YEAR(COALESCE(updated_at, created_at)) = YEAR(CURDATE())
       GROUP BY tenant_id`,
    )) as Array<{ tenant_id: number; cnt: number }>;
    for (const r of consumed ?? []) {
      consumedById.set(Number(r.tenant_id), Number(r.cnt ?? 0));
    }
  } catch {
    // ignore
  }

  const year = new Date().getFullYear();
  return (rows ?? []).map((row) => {
    const y = ytdById.get(Number(row.tenant_id));
    const fromCol =
      y && y.year === year ? y.used : null;
    const fromConsumed = consumedById.get(Number(row.tenant_id)) ?? 0;
    const usedYtd =
      fromCol != null && fromCol > 0 ? fromCol : Math.max(fromCol ?? 0, fromConsumed);
    const stats = annualMeetStats({
      tier: row.soccs_tier,
      usedYtd,
      ytdYear: year,
    });
    return { ...row, ...stats };
  });
}

function isMissingSoccsPlatformColumnsError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    msg.includes("soccs_platform_role") || msg.includes("soccs_platform_scope")
  );
}

function requireTenantAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return {
      error: NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      ),
      session: null,
    };
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      ),
      session: null,
    };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return {
      error: NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      ),
      session: null,
    };
  }
  return { error: null, session };
}

async function isKasicaSession(roleId: number | null | undefined): Promise<boolean> {
  if (!roleId) return false;
  try {
    const rows = await query<{ naziv: string }>(
      `SELECT naziv FROM roles WHERE role_id = ? LIMIT 1`,
      [roleId],
    );
    return String(rows?.[0]?.naziv ?? "").toLowerCase() === "kasica";
  } catch {
    return false;
  }
}

async function tenantsHasKlijentColumn(): Promise<boolean> {
  try {
    const rows = await query<{ ok: number }>(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'klijent_id'
       LIMIT 1`,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Lista tenanata (organizacija / kupaca licence). Samo kada je ENABLE_TENANT_ADMIN=true i korisnik ulogovan. */
export async function GET() {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error || !auth.session) return auth.error;

  const isKasica = await isKasicaSession(auth.session.role_id);
  const klijentSel = (await tenantsHasKlijentColumn())
    ? "t.klijent_id,"
    : "NULL AS klijent_id,";

  try {
    const rows = await query<{
      tenant_id: number;
      tenant_public_id: string | null;
      studio_licence_profile: string | null;
      billing_email: string | null;
      billing_phone: string | null;
      last_licence_alert_at: string | null;
      last_licence_alert_key: string | null;
      naziv: string;
      plan_id: number;
      plan_naziv: string;
      max_users: number;
      monthly_price: number | null;
      currency: string | null;
      soccs_tier: string | null;
      soccs_platform_role: string | null;
      soccs_platform_scope: string | null;
      soccs_federation_parent_tenant_id: number | null;
      federation_naziv: string | null;
      subscription_starts_at: string;
      subscription_ends_at: string;
      status: string;
      days_until_end: number;
      meet_remaining: number;
      licence_token: string | null;
      soccs_first_install_consumed: number;
    }>(
      `SELECT
        t.tenant_id,
        t.tenant_public_id,
        ${klijentSel}
        t.studio_licence_profile,
        t.billing_email,
        t.billing_phone,
        DATE_FORMAT(t.last_licence_alert_at, '%Y-%m-%d %H:%i:%s') AS last_licence_alert_at,
        t.last_licence_alert_key,
        t.naziv,
        t.plan_id,
        p.naziv AS plan_naziv,
        COALESCE(t.max_users, p.max_users) AS max_users,
        COALESCE(t.broj_blagajni, 1) AS broj_blagajni,
        t.monthly_price,
        t.currency,
        t.soccs_tier,
        t.soccs_platform_role,
        t.soccs_platform_scope,
        t.soccs_federation_parent_tenant_id,
        fp.naziv AS federation_naziv,
        DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
        DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
        t.status,
        DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
        (
          SELECT COUNT(*)
          FROM soccs_activation_codes sac
          WHERE sac.tenant_id = t.tenant_id
            AND sac.purpose = 'MEET_SESSION'
            AND UPPER(sac.status) = 'ISSUED'
            AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
        ) AS meet_remaining,
        t.licence_token,
        (
          SELECT CASE WHEN EXISTS (
            SELECT 1 FROM soccs_activation_codes s2
            WHERE s2.tenant_id = t.tenant_id
              AND s2.purpose = 'FIRST_INSTALL'
              AND s2.consumed_installation_id IS NOT NULL
          ) THEN 1 ELSE 0 END
        ) AS soccs_first_install_consumed
       FROM tenants t
       JOIN plans p ON p.plan_id = t.plan_id
       LEFT JOIN tenants fp ON fp.tenant_id = t.soccs_federation_parent_tenant_id
       ORDER BY t.naziv ASC`,
    );

    const finalRows = await attachAnnualMeetQuota(rows ?? []);
    const sanitizedRows = isKasica
      ? finalRows.map((r) => ({
          ...r,
          monthly_price: null,
          currency: null,
          billing_email: null,
          billing_phone: null,
        }))
      : finalRows;

    return NextResponse.json({
      ok: true,
      tenants: sanitizedRows,
    });
  } catch (e: unknown) {
    if (isMissingSoccsPlatformColumnsError(e)) {
      const rows = await query<{
        tenant_id: number;
        tenant_public_id: string | null;
        studio_licence_profile: string | null;
        billing_email: string | null;
        billing_phone: string | null;
        last_licence_alert_at: string | null;
        last_licence_alert_key: string | null;
        naziv: string;
        plan_id: number;
        plan_naziv: string;
        max_users: number;
        monthly_price: number | null;
        currency: string | null;
        soccs_tier: string | null;
        soccs_platform_role: string | null;
        soccs_platform_scope: string | null;
        soccs_federation_parent_tenant_id: number | null;
        federation_naziv: string | null;
        subscription_starts_at: string;
        subscription_ends_at: string;
        status: string;
        days_until_end: number;
        meet_remaining: number;
        licence_token: string | null;
        soccs_first_install_consumed: number;
      }>(
        `SELECT
          t.tenant_id,
          t.tenant_public_id,
          ${klijentSel}
          t.studio_licence_profile,
          t.billing_email,
          t.billing_phone,
          DATE_FORMAT(t.last_licence_alert_at, '%Y-%m-%d %H:%i:%s') AS last_licence_alert_at,
          t.last_licence_alert_key,
          t.naziv,
          t.plan_id,
          p.naziv AS plan_naziv,
          COALESCE(t.max_users, p.max_users) AS max_users,
          t.monthly_price,
          t.currency,
          t.soccs_tier,
          NULL AS soccs_platform_role,
          NULL AS soccs_platform_scope,
          t.soccs_federation_parent_tenant_id,
          fp.naziv AS federation_naziv,
          DATE_FORMAT(t.subscription_starts_at, '%Y-%m-%d') AS subscription_starts_at,
          DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
          t.status,
          DATEDIFF(t.subscription_ends_at, CURDATE()) AS days_until_end,
          (
            SELECT COUNT(*)
            FROM soccs_activation_codes sac
            WHERE sac.tenant_id = t.tenant_id
              AND sac.purpose = 'MEET_SESSION'
              AND UPPER(sac.status) = 'ISSUED'
              AND (sac.valid_until IS NULL OR sac.valid_until >= NOW())
          ) AS meet_remaining,
          t.licence_token,
          (
            SELECT CASE WHEN EXISTS (
              SELECT 1 FROM soccs_activation_codes s2
              WHERE s2.tenant_id = t.tenant_id
                AND s2.purpose = 'FIRST_INSTALL'
                AND s2.consumed_installation_id IS NOT NULL
            ) THEN 1 ELSE 0 END
          ) AS soccs_first_install_consumed
         FROM tenants t
         JOIN plans p ON p.plan_id = t.plan_id
         LEFT JOIN tenants fp ON fp.tenant_id = t.soccs_federation_parent_tenant_id
         ORDER BY t.naziv ASC`,
      );
      return NextResponse.json({
        ok: true,
        tenants: await attachAnnualMeetQuota(rows ?? []),
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

const MAX_USER_OPTIONS = [1, 3, 5, 10, 50, 101] as const; // 101 = 100+

/** Novi tenant. Body uključuje studio_licence_profile (čarobnjak): FLUXA_ONLY | SOCCS_SWIMVOICE | FLUXA_AND_SOCCS. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error) return auth.error;

  let body: {
    naziv?: string;
    klijent_id?: number | null;
    plan_id?: number;
    max_users?: number;
    broj_blagajni?: number | string | null;
    subscription_starts_at?: string;
    subscription_ends_at?: string;
    monthly_price?: number | string | null;
    currency?: string | null;
    soccs_tier?: string | null;
    soccs_platform_role?: string | null;
    soccs_platform_scope?: string | null;
    studio_licence_profile?: string | null;
    status?: string;
    is_pilot?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  // Naziv vezan za klijenta iz šifarnika (naplata licence kroz Fluxa fakturisanje).
  // Fallback na slobodan naziv samo ako klijent_id nije poslan (kompatibilnost).
  const klijentId =
    body?.klijent_id != null && Number.isInteger(Number(body.klijent_id)) && Number(body.klijent_id) > 0
      ? Number(body.klijent_id)
      : null;
  let naziv = String(body?.naziv ?? "").trim();
  if (klijentId) {
    const kRows = await query<{ naziv_klijenta: string }>(
      `SELECT naziv_klijenta FROM klijenti WHERE klijent_id = ? LIMIT 1`,
      [klijentId],
    );
    const kNaziv = String(kRows?.[0]?.naziv_klijenta ?? "").trim();
    if (!kNaziv) {
      return NextResponse.json(
        { ok: false, error: "KLIJENT_NOT_FOUND" },
        { status: 400 },
      );
    }
    naziv = kNaziv;
  }
  if (!naziv) {
    return NextResponse.json(
      { ok: false, error: "NAZIV_REQUIRED" },
      { status: 400 },
    );
  }

  const profile = normalizeStudioLicenceProfile(
    String(body?.studio_licence_profile ?? ""),
  );
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "STUDIO_LICENCE_PROFILE_REQUIRED" },
      { status: 400 },
    );
  }

  // Profili bez Fluxa pretplate koriste stub plan (kao čisti SOCCS).
  const usesStubPlan =
    profile === "SOCCS_SWIMVOICE" ||
    profile === "DOCENTRE" ||
    profile === "ENTERSYS";

  let planId = Number(body?.plan_id);
  if (usesStubPlan) {
    const stubRows = await query<{ plan_id: number }>(
      `SELECT plan_id FROM plans WHERE naziv = ? LIMIT 1`,
      [STUDIO_STUB_NO_FLUXA_PLAN_NAZIV],
    );
    const stubId = stubRows[0]?.plan_id;
    if (!stubId) {
      return NextResponse.json(
        {
          ok: false,
          error: "STUB_FLUXA_PLAN_MISSING",
          hint: "Pokreni scripts/sql/alter-tenants-studio-licence-profile.sql na bazi.",
        },
        { status: 500 },
      );
    }
    planId = stubId;
  } else if (!Number.isInteger(planId) || planId <= 0) {
    return NextResponse.json(
      { ok: false, error: "PLAN_ID_REQUIRED" },
      { status: 400 },
    );
  }

  const maxUsers = body?.max_users != null ? Number(body.max_users) : 5;
  if (
    !MAX_USER_OPTIONS.includes(maxUsers as (typeof MAX_USER_OPTIONS)[number])
  ) {
    const valid = MAX_USER_OPTIONS.join(", ");
    return NextResponse.json(
      { ok: false, error: "MAX_USERS_INVALID", valid },
      { status: 400 },
    );
  }

  const startRaw = String(body?.subscription_starts_at ?? "")
    .trim()
    .slice(0, 10);
  const endRaw = String(body?.subscription_ends_at ?? "")
    .trim()
    .slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startRaw) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endRaw)
  ) {
    return NextResponse.json(
      { ok: false, error: "DATES_REQUIRED" },
      { status: 400 },
    );
  }

  const wantsPilot =
    body?.is_pilot === true ||
    String(body?.status ?? "")
      .trim()
      .toUpperCase() === "PILOT";
  const tenantStatus = wantsPilot ? "PILOT" : "AKTIVAN";

  const rawPrice = body?.monthly_price;
  let monthlyPrice = wantsPilot
    ? 0
    : rawPrice != null && rawPrice !== ""
      ? Number(rawPrice)
      : null;
  const currency =
    typeof body?.currency === "string"
      ? body.currency.trim().slice(0, 3) || null
      : null;

  const crypto = await import("node:crypto");
  const licenceToken = crypto.randomBytes(24).toString("hex");
  const tenantPublicId = crypto.randomUUID();
  const soccsTierRaw =
    body?.soccs_tier != null
      ? String(body.soccs_tier).trim().toUpperCase()
      : "";
  const allowedTier = [
    "BASIC",
    "BASIC_PLUS",
    "PROFESSIONAL",
    "ENTERPRISE",
    "SWIMVOICE",
  ];
  let soccsTier: string | null = null;
  if (profile === "FLUXA_ONLY" || profile === "DOCENTRE") {
    soccsTier = null;
  } else if (profile === "ENTERSYS") {
    soccsTier = isEnterSysBasePackageId(soccsTierRaw) ? soccsTierRaw : null;
  } else if (profile === "SOCCS_SWIMVOICE") {
    if (!soccsTierRaw || !allowedTier.includes(soccsTierRaw)) {
      return NextResponse.json(
        { ok: false, error: "SOCCS_TIER_REQUIRED" },
        { status: 400 },
      );
    }
    soccsTier = soccsTierRaw;
  } else {
    if (soccsTierRaw && allowedTier.includes(soccsTierRaw)) {
      soccsTier = soccsTierRaw;
    } else {
      soccsTier = null;
    }
  }

  const platformRoleRaw =
    body?.soccs_platform_role != null
      ? String(body.soccs_platform_role).trim().toUpperCase()
      : "";
  const platformRoleAllowed = ["OWNER", "AMBASSADOR"];
  let soccsPlatformRole = platformRoleRaw
    ? platformRoleAllowed.includes(platformRoleRaw)
      ? platformRoleRaw
      : null
    : null;
  const scopeRaw =
    body?.soccs_platform_scope != null
      ? String(body.soccs_platform_scope).trim()
      : "";
  let soccsPlatformScope = scopeRaw || null;

  if (profile === "FLUXA_ONLY" || profile === "DOCENTRE") {
    soccsPlatformRole = null;
    soccsPlatformScope = null;
  }
  if (profile === "ENTERSYS") {
    soccsPlatformRole = null;
    if (!soccsPlatformScope && soccsTier) {
      const pkg = getEnterSysBasePackage(soccsTier);
      const modules = ["enterCore"];
      if (pkg && pkg.managerModule !== "enterCore") {
        modules.push(pkg.managerModule);
      }
      soccsPlatformScope = modules.join(",");
    }
    if (!wantsPilot) {
      try {
        await ensureEnterSysCjenovnikTable();
        const catalog = await listEnterSysCjenovnik();
        const calc = calculateEnterSysMonthly({
          packageId: soccsTier,
          moduleKeys: String(soccsPlatformScope ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          currency,
          catalog,
        });
        monthlyPrice = calc.total;
      } catch {
        // ostavi wizard cijenu
      }
    }
  }

  // tenants.klijent_id postoji tek nakon migracije — upiši samo ako kolona postoji.
  let hasKlijentCol = false;
  try {
    const colRows = await query<{ ok: number }>(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'klijent_id'
       LIMIT 1`,
    );
    hasKlijentCol = Array.isArray(colRows) && colRows.length > 0;
  } catch {
    hasKlijentCol = false;
  }
  const klijentCol = hasKlijentCol ? ", klijent_id" : "";
  const klijentPlc = hasKlijentCol ? ", ?" : "";
  const klijentVals = hasKlijentCol ? [klijentId] : [];

  try {
    const brojBlagajni = body?.broj_blagajni != null && Number.isInteger(Number(body.broj_blagajni)) && Number(body.broj_blagajni) > 0 ? Number(body.broj_blagajni) : 1;
    const res = await query(
      `INSERT INTO tenants (naziv, plan_id, max_users, broj_blagajni, subscription_starts_at, subscription_ends_at, status, licence_token, monthly_price, currency, tenant_public_id, studio_licence_profile, soccs_tier, soccs_platform_role, soccs_platform_scope${klijentCol})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${klijentPlc})`,
      [
        naziv,
        planId,
        maxUsers,
        brojBlagajni,
        startRaw,
        endRaw,
        tenantStatus,
        licenceToken,
        monthlyPrice ?? null,
        currency,
        tenantPublicId,
        profile,
        soccsTier,
        soccsPlatformRole,
        soccsPlatformScope,
        ...klijentVals,
      ],
    );
    const header = Array.isArray(res) ? res[0] : res;
    const insertId = (header as { insertId?: number })?.insertId;
    return NextResponse.json({
      ok: true,
      tenant_id: insertId ?? null,
      licence_token: licenceToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
