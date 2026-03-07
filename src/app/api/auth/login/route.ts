import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSessionToken, getSessionCookieAttributes, COOKIE_NAME } from "@/lib/auth/session";
import { normalizePassword } from "@/lib/auth/normalize-password";

export const dynamic = "force-dynamic";

type UserRow = { user_id: number; username: string; password: string; role_id: number | null; nivo_ovlastenja: number | null };

export async function POST(req: NextRequest) {
  try {
    let body: { username?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "").trim();
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_CREDENTIALS" }, { status: 400 });
    }

    let rows: UserRow[];
    try {
      rows = await query<UserRow>(
        `SELECT u.user_id, u.username, u.password, u.role_id,
                COALESCE(r.nivo_ovlascenja, 0) AS nivo_ovlastenja
           FROM users u
           LEFT JOIN roles r ON r.role_id = u.role_id
           WHERE u.username = ? AND u.aktivan = 1
           LIMIT 1`,
        [username]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("nivo_ovlascenja") || msg.includes("nivo_ovlastenja")) {
        rows = await query<UserRow>(
          `SELECT u.user_id, u.username, u.password, u.role_id,
                  COALESCE(r.nivo_ovlastenja, 0) AS nivo_ovlastenja
             FROM users u
             LEFT JOIN roles r ON r.role_id = u.role_id
             WHERE u.username = ? AND u.aktivan = 1
             LIMIT 1`,
          [username]
        );
      } else {
        throw err;
      }
    }

    const user = rows?.[0];
    if (!user) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const storedPassword = user.password ?? "";
    const passwordNorm = normalizePassword(password);
    let valid = false;
    if (storedPassword.startsWith("$2")) {
      valid = await bcrypt.compare(passwordNorm, storedPassword);
      if (!valid) valid = await bcrypt.compare(password, storedPassword);
    } else {
      valid = passwordNorm === storedPassword || password === storedPassword;
    }

    if (!valid) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    await query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [user.user_id]
    ).catch(() => {});

    const nivo = Number(user.nivo_ovlastenja ?? 0);
    const token = createSessionToken({
      user_id: user.user_id,
      username: user.username,
      role_id: user.role_id,
      nivo,
    });

    const attrs = getSessionCookieAttributes();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(attrs.name, token, {
      maxAge: attrs.maxAge,
      httpOnly: attrs.httpOnly,
      secure: attrs.secure,
      sameSite: attrs.sameSite,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("AUTH_SECRET") || msg.includes("SESSION_SECRET")) {
      return NextResponse.json({ ok: false, error: "MISSING_AUTH_SECRET" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
