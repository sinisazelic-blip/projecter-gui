import {
  normalizeSoccsTier,
  soccsTierToLimits,
  type SoccsTier,
} from "@/lib/soccs-activation";
import { query } from "@/lib/db";

let ytdColsReady: Promise<boolean> | null = null;

export async function ensureSoccsMeetsYtdColumns(): Promise<boolean> {
  if (ytdColsReady) return ytdColsReady;
  ytdColsReady = (async () => {
    try {
      const cols = (await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'
           AND COLUMN_NAME = 'soccs_meets_used_ytd'`,
      )) as Array<{ COLUMN_NAME: string }>;
      if (!cols?.length) {
        await query(`
          ALTER TABLE tenants
            ADD COLUMN soccs_meets_used_ytd INT NOT NULL DEFAULT 0
              COMMENT 'Broj odobrenih takmičenja u tekućoj kalendarskoj godini',
            ADD COLUMN soccs_meets_ytd_year SMALLINT NULL
              COMMENT 'Godina na koju se odnosi soccs_meets_used_ytd'
        `);
      }
      return true;
    } catch (e) {
      console.warn(
        "[soccs] ensureSoccsMeetsYtdColumns:",
        (e as Error)?.message || e,
      );
      ytdColsReady = null;
      return false;
    }
  })();
  return ytdColsReady;
}

export function maxMeetsPerYearForTier(
  tierRaw: string | null | undefined,
): number | null {
  const tier = normalizeSoccsTier(tierRaw) as SoccsTier;
  const limits = soccsTierToLimits(tier);
  const v = limits.max_meets_per_year;
  return v == null ? null : Number(v);
}

/** Reset YTD ako se godina promijenila; inače inkrement. */
export async function bumpTenantMeetsUsedYtd(tenantId: number): Promise<void> {
  const id = Number(tenantId);
  if (!Number.isFinite(id) || id <= 0) return;
  const ok = await ensureSoccsMeetsYtdColumns();
  if (!ok) return;
  const year = new Date().getFullYear();
  try {
    await query(
      `UPDATE tenants
       SET
         soccs_meets_used_ytd = CASE
           WHEN soccs_meets_ytd_year IS NULL OR soccs_meets_ytd_year <> ?
             THEN 1
           ELSE COALESCE(soccs_meets_used_ytd, 0) + 1
         END,
         soccs_meets_ytd_year = ?
       WHERE tenant_id = ?`,
      [year, year, id],
    );
  } catch (e) {
    console.warn("[soccs] bumpTenantMeetsUsedYtd:", (e as Error)?.message || e);
  }
}

export function annualMeetStats(opts: {
  tier: string | null | undefined;
  usedYtd: number | null | undefined;
  ytdYear: number | null | undefined;
}): {
  max_meets_per_year: number | null;
  meets_used_ytd: number;
  meets_remaining_year: number | null;
} {
  const max = maxMeetsPerYearForTier(opts.tier);
  const year = new Date().getFullYear();
  const storedYear = opts.ytdYear != null ? Number(opts.ytdYear) : null;
  const usedRaw = Number(opts.usedYtd ?? 0);
  const used =
    !Number.isFinite(usedRaw) || storedYear == null || storedYear !== year
      ? 0
      : Math.max(0, Math.floor(usedRaw));
  const remaining = max == null ? null : Math.max(0, max - used);
  return {
    max_meets_per_year: max,
    meets_used_ytd: used,
    meets_remaining_year: remaining,
  };
}
