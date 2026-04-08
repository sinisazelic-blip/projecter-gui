import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizePassword } from "@/lib/auth/normalize-password";
import {
  COOKIE_NAME,
  createSessionToken,
  getSessionCookieAttributes,
  verifySessionToken,
} from "@/lib/auth/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 10;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token)
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );

  const session = verifySessionToken(token);
  if (
    !session ||
    session.bootstrap !== true ||
    session.mustChangePassword !== true
  ) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  let body: { password?: string; passwordConfirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const password = normalizePassword(String(body?.password ?? ""));
  const passwordConfirm = normalizePassword(
    String(body?.passwordConfirm ?? ""),
  );
  if (!password || !passwordConfirm) {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_REQUIRED" },
      { status: 400 },
    );
  }
  if (password !== passwordConfirm) {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_MISMATCH" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_TOO_SHORT" },
      { status: 400 },
    );
  }
  if (password.toLowerCase() === "fluxa") {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_TOO_WEAK" },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const users = await query<{ user_id: number; role_id: number | null }>(
    `SELECT user_id, role_id FROM users
     WHERE LOWER(username) = 'fluxa' AND aktivan = 1
     ORDER BY user_id ASC
     LIMIT 1`,
  );
  const fluxaUser = users?.[0];
  if (!fluxaUser) {
    return NextResponse.json(
      { ok: false, error: "FLUXA_USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  await query(
    `UPDATE users SET password = ?, updated_at = NOW() WHERE user_id = ?`,
    [hash, fluxaUser.user_id],
  );
  await query(
    `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [fluxaUser.user_id],
  ).catch(() => {});

  const nextToken = createSessionToken({
    user_id: fluxaUser.user_id,
    username: "fluxa",
    role_id: fluxaUser.role_id,
    nivo: 10,
    isDemo: false,
    bootstrap: false,
    mustChangePassword: false,
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
