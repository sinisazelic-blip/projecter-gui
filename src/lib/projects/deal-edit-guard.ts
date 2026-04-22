import { COOKIE_NAME, verifySessionToken, type SessionPayload } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";

const LOCKED_PROJECT_STATUSES = new Set([8, 9, 10, 12]);
const OWNER_NIVO = 10;

type ProjectLockInfo = {
  projekat_id: number | null;
  project_status_id: number | null;
  is_locked: boolean;
};

function getCookieValue(req: Request, key: string): string | null {
  const cookie = req.headers.get("cookie") || "";
  const parts = cookie.split(";").map((x) => x.trim());
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== key) continue;
    return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const token = getCookieValue(req, COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(token);
}

export function isOwnerLike(session: SessionPayload | null): boolean {
  return Number(session?.nivo ?? 0) >= OWNER_NIVO;
}

export async function ensureEditOverrideTable() {
  await query(
    `
    CREATE TABLE IF NOT EXISTS project_edit_overrides (
      override_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      projekat_id BIGINT UNSIGNED NOT NULL,
      reason VARCHAR(500) NOT NULL,
      expires_at DATETIME NOT NULL,
      enabled_by_user_id BIGINT UNSIGNED NULL,
      enabled_by_username VARCHAR(191) NULL,
      disabled_at DATETIME NULL,
      disabled_by_user_id BIGINT UNSIGNED NULL,
      disabled_by_username VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (override_id),
      KEY idx_project_edit_overrides_project (projekat_id),
      KEY idx_project_edit_overrides_expires (expires_at),
      KEY idx_project_edit_overrides_disabled (disabled_at)
    )
    `,
  );
}

export async function getProjectLockInfoForDeal(
  inicijacijaId: number,
): Promise<ProjectLockInfo> {
  const rows = await query<{
    projekat_id: number | null;
    project_status_id: number | null;
  }>(
    `
    SELECT
      i.projekat_id AS projekat_id,
      p.status_id AS project_status_id
    FROM inicijacije i
    LEFT JOIN projekti p ON p.projekat_id = i.projekat_id
    WHERE i.inicijacija_id = ?
    LIMIT 1
    `,
    [inicijacijaId],
  );

  const row = rows?.[0];
  const projekatId = row?.projekat_id ? Number(row.projekat_id) : null;
  const projectStatusId =
    row?.project_status_id !== null && row?.project_status_id !== undefined
      ? Number(row.project_status_id)
      : null;

  return {
    projekat_id: Number.isFinite(projekatId as number) ? (projekatId as number) : null,
    project_status_id: Number.isFinite(projectStatusId as number)
      ? (projectStatusId as number)
      : null,
    is_locked:
      Number.isFinite(projectStatusId as number) &&
      LOCKED_PROJECT_STATUSES.has(Number(projectStatusId)),
  };
}

export async function hasActiveProjectEditOverride(projekatId: number) {
  await ensureEditOverrideTable();
  const rows = await query<{ override_id: number }>(
    `
    SELECT override_id
    FROM project_edit_overrides
    WHERE projekat_id = ?
      AND disabled_at IS NULL
      AND expires_at > NOW()
    ORDER BY override_id DESC
    LIMIT 1
    `,
    [projekatId],
  );
  return (rows?.length ?? 0) > 0;
}

export async function assertDealEditableOrThrow(
  req: Request,
  inicijacijaId: number,
) {
  const lockInfo = await getProjectLockInfoForDeal(inicijacijaId);
  if (!lockInfo.is_locked || !lockInfo.projekat_id) return;

  const session = getSessionFromRequest(req);
  const isOwner = isOwnerLike(session);
  if (isOwner && (await hasActiveProjectEditOverride(lockInfo.projekat_id))) {
    return;
  }

  const err: any = new Error("PROJECT_LOCKED");
  err.status = 423;
  err.details = {
    projekat_id: lockInfo.projekat_id,
    status_id: lockInfo.project_status_id,
    owner_can_override: isOwner,
  };
  throw err;
}

export async function enableProjectEditOverride(args: {
  projekatId: number;
  reason: string;
  minutes: number;
  session: SessionPayload;
}) {
  await ensureEditOverrideTable();
  const reason = args.reason.trim().slice(0, 500);
  const minutes = Math.min(240, Math.max(5, Math.trunc(args.minutes)));
  await query(
    `
    INSERT INTO project_edit_overrides
      (projekat_id, reason, expires_at, enabled_by_user_id, enabled_by_username)
    VALUES
      (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)
    `,
    [
      args.projekatId,
      reason,
      minutes,
      args.session.user_id ?? null,
      args.session.username ?? null,
    ],
  );
  await audit("project.edit_override.enabled", {
    projekat_id: args.projekatId,
    reason,
    minutes,
    user_id: args.session.user_id,
    username: args.session.username,
  });
}

export async function disableProjectEditOverride(args: {
  projekatId: number;
  session: SessionPayload;
}) {
  await ensureEditOverrideTable();
  await query(
    `
    UPDATE project_edit_overrides
    SET
      disabled_at = NOW(),
      disabled_by_user_id = ?,
      disabled_by_username = ?
    WHERE projekat_id = ?
      AND disabled_at IS NULL
      AND expires_at > NOW()
    `,
    [args.session.user_id ?? null, args.session.username ?? null, args.projekatId],
  );
  await audit("project.edit_override.disabled", {
    projekat_id: args.projekatId,
    user_id: args.session.user_id,
    username: args.session.username,
  });
}

export async function getProjectEditOverrideState(projekatId: number) {
  await ensureEditOverrideTable();
  const rows = await query<{
    override_id: number;
    reason: string;
    expires_at: string;
    enabled_by_username: string | null;
    enabled_by_user_id: number | null;
  }>(
    `
    SELECT
      override_id,
      reason,
      DATE_FORMAT(expires_at, '%Y-%m-%d %H:%i:%s') AS expires_at,
      enabled_by_username,
      enabled_by_user_id
    FROM project_edit_overrides
    WHERE projekat_id = ?
      AND disabled_at IS NULL
      AND expires_at > NOW()
    ORDER BY override_id DESC
    LIMIT 1
    `,
    [projekatId],
  );
  return rows?.[0] ?? null;
}
