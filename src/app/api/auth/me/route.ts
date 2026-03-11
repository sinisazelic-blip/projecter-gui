import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { COOKIE_NAME } from "@/lib/auth/session";
import { query, runWithSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return runWithSession(session, async () => {
  let onboardingCompleted = false;
  try {
    const onboardingRows = await query<{ n: number }>(
      `SELECT 1 AS n FROM onboarding_completed WHERE user_id = ? LIMIT 1`,
      [session.user_id]
    );
    onboardingCompleted = (onboardingRows?.length ?? 0) > 0;
  } catch {
    // onboarding_completed tabela možda ne postoji – pokreni scripts/create-onboarding-completed.sql
  }

  const payload: {
    user: { user_id: number; username: string; role_id: number | null; nivo: number; isDemo?: boolean };
    subscription_ends_at?: string;
    subscription_expired?: boolean;
    onboarding_completed?: boolean;
  } = {
    user: {
      user_id: session.user_id,
      username: session.username,
      role_id: session.role_id,
      nivo: session.nivo,
      isDemo: session.isDemo === true,
    },
    onboarding_completed: onboardingCompleted,
  };

  if (process.env.ENABLE_TENANT_ADMIN === "true") {
    try {
      const defaultTenantId = process.env.DEFAULT_TENANT_ID ? Number(process.env.DEFAULT_TENANT_ID) : 1;
      const rows = await query<{ subscription_ends_at: string; status: string }>(
        `SELECT DATE_FORMAT(subscription_ends_at, '%Y-%m-%d') AS subscription_ends_at, status
         FROM tenants WHERE tenant_id = ? LIMIT 1`,
        [defaultTenantId]
      );
      const row = rows?.[0];
      if (row) {
        payload.subscription_ends_at = row.subscription_ends_at;
        const today = new Date().toISOString().slice(0, 10);
        const dateExpired = row.subscription_ends_at < today;
        const suspended = String(row.status).toUpperCase() === "SUSPENDOVAN";
        payload.subscription_expired = dateExpired || suspended;
      }
    } catch {
      // ako tabela ne postoji ili greška, ne blokiramo login
    }
  }

  return NextResponse.json(payload);
  });
}
