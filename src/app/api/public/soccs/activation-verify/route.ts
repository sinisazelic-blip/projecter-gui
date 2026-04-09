import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  buildSoccsLicenseJwtLike,
  normalizeSoccsTier,
  type SoccsTier,
  soccsTierToLimits,
  soccsTierToModules,
} from "@/lib/soccs-activation";

export const dynamic = "force-dynamic";

type VerifyBody = {
  code?: string;
  meet_code?: string | null;
  installation_public_id?: string;
  purpose?: string;
  app?: string;
  app_version?: string;
};

/** Uklanja BOM / zero-width / krajnje razmake — često uzrok „istog” ključa koji se ne poklapa. */
function normalizeBearerSecret(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function requireBearer(req: NextRequest): boolean {
  const rawExpected = process.env.SOCCS_ACTIVATION_VERIFY_BEARER;
  const expected = rawExpected ? normalizeBearerSecret(rawExpected) : "";
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const m = /^Bearer\s+([\s\S]+)$/i.exec(auth.trim());
  const token = m ? normalizeBearerSecret(m[1]) : "";
  if (!token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8"),
    );
  } catch {
    return false;
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type TenantRow = {
  tenant_id: number;
  tenant_public_id: string;
  naziv: string;
  soccs_tier: string | null;
  subscription_ends_at: string;
  status: string;
};

async function loadTenantById(id: number): Promise<TenantRow | null> {
  const rows = await query<TenantRow>(
    `SELECT
       t.tenant_id,
       t.tenant_public_id,
       t.naziv,
       t.soccs_tier,
       DATE_FORMAT(t.subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at,
       t.status
     FROM tenants t
     WHERE t.tenant_id = ?
     LIMIT 1`,
    [id],
  );
  return rows?.[0] ?? null;
}

/** Vraća reason ako tenant nije u redu za aktivaciju, inače null. */
function tenantBlockReason(row: TenantRow): string | null {
  const st = String(row.status).toUpperCase();
  if (st === "SUSPENDOVAN") return "tenant_suspended";
  if (st === "ISTEKLO") return "tenant_inactive";
  const today = todayStr();
  if (row.subscription_ends_at < today) return "subscription_expired";
  return null;
}

/**
 * Dijagnostika (bez otkrivanja tajne): da li je env učitan i kolika je duljina nakon normalizacije.
 * GET u browseru: …/activation-verify — ako bearerConfigured:false, DO ne injektuje varijablu u ovaj servis.
 */
export async function GET() {
  const raw = process.env.SOCCS_ACTIVATION_VERIFY_BEARER;
  const normalized = raw ? normalizeBearerSecret(raw) : "";
  return NextResponse.json(
    {
      ok: true,
      bearerConfigured: Boolean(normalized),
      bearerCharLength: normalized.length,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

/**
 * SOCCS poziva ovaj endpoint (POST). Master zna tenant + aktivacijske kodove.
 * Isti Bearer tajni string kao SOCCS_FLUX_ACTIVATION_BEARER na SOCCS strani → SOCCS_ACTIVATION_VERIFY_BEARER na Fluxi.
 */
export async function POST(req: NextRequest) {
  if (!requireBearer(req)) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized", retryable: false },
      { status: 401 },
    );
  }

  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_body", retryable: false },
      { status: 400 },
    );
  }

  const code = String(body?.code ?? "").trim();
  const installationPublicId = String(
    body?.installation_public_id ?? "",
  ).trim();
  const purposeRaw = String(body?.purpose ?? "")
    .trim()
    .toUpperCase();
  const meetCode = body?.meet_code != null ? String(body.meet_code).trim() : "";

  if (!code || !installationPublicId) {
    return NextResponse.json(
      { ok: false, reason: "missing_fields", retryable: false },
      { status: 400 },
    );
  }

  if (purposeRaw !== "FIRST_INSTALL" && purposeRaw !== "MEET_SESSION") {
    return NextResponse.json(
      { ok: false, reason: "invalid_purpose", retryable: false },
      { status: 400 },
    );
  }

  const app = String(body?.app ?? "")
    .trim()
    .toLowerCase();
  if (app && app !== "soccs") {
    return NextResponse.json(
      { ok: false, reason: "unsupported_app", retryable: false },
      { status: 400 },
    );
  }

  try {
    if (purposeRaw === "FIRST_INSTALL") {
      return await handleFirstInstall(code, installationPublicId);
    }
    if (!meetCode) {
      return NextResponse.json(
        { ok: false, reason: "meet_code_required", retryable: false },
        { status: 400 },
      );
    }
    return await handleMeetSession(code, meetCode, installationPublicId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unknown column") || msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          ok: false,
          reason: "flux_schema_not_migrated",
          message:
            "Pokreni scripts/sql/alter-soccs-tenant-bridge.sql na master bazi.",
          retryable: false,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, reason: "server_error", message: msg, retryable: true },
      { status: 500 },
    );
  }
}

async function handleFirstInstall(code: string, installationPublicId: string) {
  type AcRow = {
    id: number;
    tenant_id: number;
    status: string;
    valid_until: string | null;
    consumed_installation_id: string | null;
    uses_count: number;
    max_uses: number;
  };

  const acRows = await query<AcRow>(
    `SELECT id, tenant_id, status,
            DATE_FORMAT(valid_until, '%Y-%m-%d %H:%i:%s') AS valid_until,
            consumed_installation_id, uses_count, max_uses
     FROM soccs_activation_codes
     WHERE code = ? AND purpose = 'FIRST_INSTALL'
     LIMIT 1`,
    [code],
  );
  const ac = acRows?.[0];
  if (!ac) {
    return NextResponse.json(
      { ok: false, reason: "invalid_code", retryable: false },
      { status: 200 },
    );
  }

  if (String(ac.status).toUpperCase() === "REVOKED") {
    return NextResponse.json(
      { ok: false, reason: "code_revoked", retryable: false },
      { status: 200 },
    );
  }

  const now = new Date();
  if (ac.valid_until) {
    const vu = new Date(ac.valid_until.replace(" ", "T"));
    if (!Number.isNaN(vu.getTime()) && vu < now) {
      return NextResponse.json(
        { ok: false, reason: "code_expired", retryable: false },
        { status: 200 },
      );
    }
  }

  const tenant = await loadTenantById(ac.tenant_id);
  if (!tenant) {
    return NextResponse.json(
      { ok: false, reason: "tenant_missing", retryable: false },
      { status: 200 },
    );
  }

  const block = tenantBlockReason(tenant);
  if (block) {
    return NextResponse.json({ ok: false, reason: block, retryable: false }, { status: 200 });
  }

  if (ac.consumed_installation_id) {
    if (ac.consumed_installation_id === installationPublicId) {
      return jsonSuccess(tenant, "FIRST_INSTALL", installationPublicId, null);
    }
    return NextResponse.json(
      { ok: false, reason: "code_already_used", retryable: false },
      { status: 200 },
    );
  }

  await query(
    `UPDATE soccs_activation_codes
     SET consumed_installation_id = ?, uses_count = uses_count + 1, status = 'CONSUMED', updated_at = NOW()
     WHERE id = ? AND consumed_installation_id IS NULL`,
    [installationPublicId, ac.id],
  );

  const again = await query<{ consumed_installation_id: string | null }>(
    `SELECT consumed_installation_id FROM soccs_activation_codes WHERE id = ? LIMIT 1`,
    [ac.id],
  );
  const cid = again?.[0]?.consumed_installation_id;
  if (cid === installationPublicId) {
    return jsonSuccess(tenant, "FIRST_INSTALL", installationPublicId, null);
  }
  if (cid) {
    return NextResponse.json(
      { ok: false, reason: "code_already_used", retryable: false },
      { status: 200 },
    );
  }
  return NextResponse.json(
    { ok: false, reason: "consume_failed", retryable: true },
    { status: 200 },
  );
}

async function handleMeetSession(
  tenantKey: string,
  meetCode: string,
  installationPublicId: string,
) {
  type AcRow = {
    id: number;
    tenant_id: number;
    sponsor_tenant_id: number | null;
    status: string;
    valid_until: string | null;
    meet_note: string | null;
  };

  const firstRows = await query<Pick<AcRow, "tenant_id">>(
    `SELECT tenant_id FROM soccs_activation_codes
     WHERE code = ? AND purpose = 'FIRST_INSTALL'
     LIMIT 1`,
    [tenantKey],
  );
  const first = firstRows?.[0];
  if (!first) {
    return NextResponse.json(
      { ok: false, reason: "invalid_tenant_code", retryable: false },
      { status: 200 },
    );
  }

  const meetRows = await query<AcRow>(
    `SELECT id, tenant_id, sponsor_tenant_id, status,
            DATE_FORMAT(valid_until, '%Y-%m-%d %H:%i:%s') AS valid_until,
            meet_note
     FROM soccs_activation_codes
     WHERE code = ? AND purpose = 'MEET_SESSION'
     LIMIT 1`,
    [meetCode],
  );
  const meet = meetRows?.[0];
  if (!meet) {
    return NextResponse.json(
      { ok: false, reason: "invalid_meet_code", retryable: false },
      { status: 200 },
    );
  }

  if (meet.tenant_id !== first.tenant_id) {
    return NextResponse.json(
      { ok: false, reason: "meet_tenant_mismatch", retryable: false },
      { status: 200 },
    );
  }

  if (String(meet.status).toUpperCase() === "REVOKED") {
    return NextResponse.json(
      { ok: false, reason: "meet_revoked", retryable: false },
      { status: 200 },
    );
  }

  const now = new Date();
  if (meet.valid_until) {
    const vu = new Date(meet.valid_until.replace(" ", "T"));
    if (!Number.isNaN(vu.getTime()) && vu < now) {
      return NextResponse.json(
        { ok: false, reason: "meet_expired", retryable: false },
        { status: 200 },
      );
    }
  }

  const tenant = await loadTenantById(meet.tenant_id);
  if (!tenant) {
    return NextResponse.json(
      { ok: false, reason: "tenant_missing", retryable: false },
      { status: 200 },
    );
  }

  const block = tenantBlockReason(tenant);
  if (block) {
    return NextResponse.json({ ok: false, reason: block, retryable: false }, { status: 200 });
  }

  let sponsorMeet: Record<string, unknown> | null = null;
  if (meet.sponsor_tenant_id != null) {
    const sponsor = await loadTenantById(meet.sponsor_tenant_id);
    if (!sponsor) {
      return NextResponse.json(
        { ok: false, reason: "sponsor_missing", retryable: false },
        { status: 200 },
      );
    }
    const sponsorBlock = tenantBlockReason(sponsor);
    if (sponsorBlock) {
      return NextResponse.json(
        { ok: false, reason: "sponsor_inactive", retryable: false },
        { status: 200 },
      );
    }
    sponsorMeet = {
      sponsor_tenant_id: sponsor.tenant_public_id,
      sponsor_naziv: sponsor.naziv,
      meet_note: meet.meet_note,
    };
  }

  return jsonSuccess(tenant, "MEET_SESSION", installationPublicId, sponsorMeet);
}

function jsonSuccess(
  tenant: TenantRow,
  purpose: "FIRST_INSTALL" | "MEET_SESSION",
  installationPublicId: string,
  meet: Record<string, unknown> | null,
) {
  const tier = normalizeSoccsTier(tenant.soccs_tier) as SoccsTier;
  const modules = soccsTierToModules(tier);
  const limits = soccsTierToLimits(tier);
  const license = buildSoccsLicenseJwtLike({
    tenantPublicId: tenant.tenant_public_id,
    tier,
    subscriptionEndsAt: tenant.subscription_ends_at,
    installationPublicId,
    purpose,
  });

  const payload: Record<string, unknown> = {
    tenant_id: tenant.tenant_public_id,
    tier: tier.toLowerCase(),
    status: "active",
    modules,
    limits,
    license,
    code_state: purpose === "FIRST_INSTALL" ? "consumed_ok" : "meet_ok",
    server_time: new Date().toISOString(),
  };
  if (meet) {
    payload.meet = meet;
  }

  return NextResponse.json(payload, { status: 200 });
}
