import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Produži pretplatu ili promijeni plan tenanta. Samo kada je ENABLE_TENANT_ADMIN=true i korisnik ulogovan. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ID" },
      { status: 400 },
    );
  }

  const MAX_USER_OPTIONS = [1, 3, 5, 10, 50, 101];
  let body: {
    subscription_ends_at?: string;
    plan_id?: number;
    status?: string;
    regenerate_licence_token?: boolean;
    max_users?: number;
    monthly_price?: number | string | null;
    currency?: string | null;
    soccs_tier?: string | null;
    soccs_platform_role?: string | null;
    soccs_platform_scope?: string | null;
    soccs_federation_parent_tenant_id?: number | null;
    meet_session_target?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const updates: string[] = [];
  const paramsList: (string | number | null)[] = [];
  let newLicenceToken: string | undefined;
  let meetSessionTarget: number | null = null;

  if (body.regenerate_licence_token === true) {
    const crypto = await import("node:crypto");
    newLicenceToken = crypto.randomBytes(24).toString("hex");
    updates.push("licence_token = ?");
    paramsList.push(newLicenceToken);
  }

  if (body.subscription_ends_at != null) {
    const d = String(body.subscription_ends_at).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      updates.push("subscription_ends_at = ?");
      paramsList.push(d);
    }
  }
  if (body.plan_id != null) {
    const planId = Number(body.plan_id);
    if (Number.isInteger(planId) && planId > 0) {
      updates.push("plan_id = ?");
      paramsList.push(planId);
    }
  }
  if (
    body.max_users != null &&
    MAX_USER_OPTIONS.includes(Number(body.max_users))
  ) {
    updates.push("max_users = ?");
    paramsList.push(Number(body.max_users));
  }
  if (body.monthly_price !== undefined) {
    updates.push("monthly_price = ?");
    const raw = body.monthly_price;
    paramsList.push(raw == null || raw === "" ? null : Number(raw));
  }
  if (body.currency !== undefined) {
    updates.push("currency = ?");
    paramsList.push(
      typeof body.currency === "string"
        ? body.currency.trim().slice(0, 3) || null
        : null,
    );
  }
  if (body.status != null) {
    const s = String(body.status).trim().toUpperCase();
    if (s === "SUSPENDOVAN" || s === "AKTIVAN" || s === "ISTEKLO") {
      updates.push("status = ?");
      paramsList.push(s);
    }
  }

  if (body.soccs_tier !== undefined) {
    const raw =
      body.soccs_tier == null
        ? ""
        : String(body.soccs_tier).trim().toUpperCase();
    const allowed = [
      "BASIC",
      "BASIC_PLUS",
      "PROFESSIONAL",
      "ENTERPRISE",
      "SWIMVOICE",
    ];
    if (!raw) {
      updates.push("soccs_tier = NULL");
    } else if (allowed.includes(raw)) {
      updates.push("soccs_tier = ?");
      paramsList.push(raw);
    }
  }

  if (body.soccs_platform_role !== undefined) {
    const raw =
      body.soccs_platform_role == null
        ? ""
        : String(body.soccs_platform_role).trim().toUpperCase();
    const allowed = ["OWNER", "AMBASSADOR"];
    if (!raw) {
      updates.push("soccs_platform_role = NULL");
    } else if (allowed.includes(raw)) {
      updates.push("soccs_platform_role = ?");
      paramsList.push(raw);
    } else {
      return NextResponse.json(
        { ok: false, error: "INVALID_SOCCS_PLATFORM_ROLE" },
        { status: 400 },
      );
    }
  }

  if (body.soccs_platform_scope !== undefined) {
    const raw =
      body.soccs_platform_scope == null
        ? ""
        : String(body.soccs_platform_scope).trim();
    if (!raw) {
      updates.push("soccs_platform_scope = NULL");
    } else {
      updates.push("soccs_platform_scope = ?");
      paramsList.push(raw);
    }
  }

  if (body.soccs_federation_parent_tenant_id !== undefined) {
    const v = body.soccs_federation_parent_tenant_id;
    if (v === null) {
      updates.push("soccs_federation_parent_tenant_id = NULL");
    } else {
      const pid = Number(v);
      if (Number.isInteger(pid) && pid > 0 && pid !== id) {
        updates.push("soccs_federation_parent_tenant_id = ?");
        paramsList.push(pid);
      }
    }
  }

  if (body.meet_session_target !== undefined) {
    if (body.meet_session_target == null) {
      meetSessionTarget = 0;
    } else {
      const n = Number(body.meet_session_target);
      if (!Number.isInteger(n) || n < 0 || n > 10000) {
        return NextResponse.json(
          { ok: false, error: "INVALID_MEET_SESSION_TARGET" },
          { status: 400 },
        );
      }
      meetSessionTarget = n;
    }
  }

  if (updates.length === 0 && meetSessionTarget == null) {
    return NextResponse.json(
      { ok: false, error: "NO_VALID_UPDATES" },
      { status: 400 },
    );
  }

  paramsList.push(id);

  try {
    if (updates.length > 0) {
      await query(
        `UPDATE tenants SET ${updates.join(", ")}, updated_at = NOW() WHERE tenant_id = ?`,
        paramsList,
      );
    }

    if (meetSessionTarget != null) {
      const currentRows = await query<{ id: number }>(
        `SELECT id
         FROM soccs_activation_codes
         WHERE tenant_id = ?
           AND purpose = 'MEET_SESSION'
           AND UPPER(status) = 'ISSUED'
           AND (valid_until IS NULL OR valid_until >= NOW())
         ORDER BY id ASC`,
        [id],
      );
      const current = currentRows.length;
      const delta = meetSessionTarget - current;

      if (delta > 0) {
        for (let i = 0; i < delta; i += 1) {
          const code = randomBytes(18).toString("hex");
          await query(
            `INSERT INTO soccs_activation_codes
              (tenant_id, sponsor_tenant_id, code, purpose, status, valid_from, valid_until, max_uses, meet_note)
             VALUES (?, NULL, ?, 'MEET_SESSION', 'ISSUED', NOW(), DATE_ADD(NOW(), INTERVAL 5 YEAR), 1, 'manual_quota_adjust')`,
            [id, code],
          );
        }
      } else if (delta < 0) {
        const revokeIds = currentRows
          .slice(0, Math.abs(delta))
          .map((r) => r.id);
        for (const codeId of revokeIds) {
          await query(
            `UPDATE soccs_activation_codes
             SET status = 'REVOKED', updated_at = NOW()
             WHERE id = ?`,
            [codeId],
          );
        }
      }
    }

    const out: {
      ok: boolean;
      licence_token?: string;
      meet_remaining?: number;
    } = { ok: true };
    if (newLicenceToken) out.licence_token = newLicenceToken;
    if (meetSessionTarget != null) out.meet_remaining = meetSessionTarget;
    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
