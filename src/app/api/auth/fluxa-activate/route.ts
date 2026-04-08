import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getSessionCookieAttributes,
  verifySessionToken,
} from "@/lib/auth/session";
import { saveFluxaActivation } from "@/lib/fluxa-activation";

export const dynamic = "force-dynamic";

function getCheckUrl(): string {
  return (
    process.env.FLUXA_ACTIVATION_CHECK_URL?.trim() ||
    process.env.LICENCE_CHECK_URL?.trim() ||
    "https://app.studiotaf.xyz/api/public/licence-check"
  );
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const session = verifySessionToken(token);
  if (!session || session.bootstrap !== true) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  let body: { companyName?: string; activationCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const companyName = String(body?.companyName ?? "").trim();
  const activationCode = String(body?.activationCode ?? "").trim();
  if (!companyName || !activationCode) {
    return NextResponse.json(
      { ok: false, error: "COMPANY_AND_CODE_REQUIRED" },
      { status: 400 },
    );
  }

  const checkUrl = getCheckUrl();
  let allowed = false;
  let reason = "";
  try {
    const res = await fetch(checkUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${activationCode}` },
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const data = await res.json().catch(() => ({}));
    allowed = data?.allowed === true;
    reason = String(data?.reason ?? "");
  } catch {
    return NextResponse.json(
      { ok: false, error: "VERIFY_NETWORK_ERROR" },
      { status: 502 },
    );
  }

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CODE", reason },
      { status: 400 },
    );
  }

  await saveFluxaActivation({
    companyName,
    licenceToken: activationCode,
    licenceCheckUrl: checkUrl,
  });

  const nextToken = createSessionToken({
    user_id: session.user_id,
    username: session.username,
    role_id: session.role_id,
    nivo: session.nivo,
    isDemo: false,
    bootstrap: true,
    mustChangePassword: true,
  });
  const attrs = getSessionCookieAttributes();
  const out = NextResponse.json({ ok: true });
  out.cookies.set(attrs.name, nextToken, {
    maxAge: attrs.maxAge,
    httpOnly: attrs.httpOnly,
    secure: attrs.secure,
    sameSite: attrs.sameSite,
    path: "/",
  });
  return out;
}
