import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Pool } from "mysql2/promise";
import { getDemoPoolOrNull, getStudioPoolExport } from "@/lib/db";
import { createSessionToken, getSessionCookieAttributes, COOKIE_NAME } from "@/lib/auth/session";
import { normalizePassword } from "@/lib/auth/normalize-password";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type UserRow = { user_id: number; username: string; password: string; role_id: number | null; nivo_ovlastenja: number | null };

const USER_SQL = `SELECT u.user_id, u.username, u.password, u.role_id,
  COALESCE(r.nivo_ovlascenja, 0) AS nivo_ovlastenja
  FROM users u LEFT JOIN roles r ON r.role_id = u.role_id
  WHERE u.username = ? AND u.aktivan = 1 LIMIT 1`;

const USER_SQL_PASSWORD_HASH = `SELECT u.user_id, u.username, u.password_hash AS password, u.role_id,
  COALESCE(r.nivo_ovlascenja, 0) AS nivo_ovlastenja
  FROM users u LEFT JOIN roles r ON r.role_id = u.role_id
  WHERE u.username = ? AND u.aktivan = 1 LIMIT 1`;

async function queryUser(pool: Pool, username: string): Promise<UserRow[]> {
  try {
    const [rows] = await pool.query(USER_SQL, [username]);
    return rows as UserRow[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("nivo_ovlascenja") || msg.includes("nivo_ovlastenja")) {
      const altSql = `SELECT u.user_id, u.username, u.password, u.role_id,
        COALESCE(r.nivo_ovlastenja, 0) AS nivo_ovlastenja
        FROM users u LEFT JOIN roles r ON r.role_id = u.role_id
        WHERE u.username = ? AND u.aktivan = 1 LIMIT 1`;
      const [altRows] = await pool.query(altSql, [username]);
      return altRows as UserRow[];
    }
    if (msg.includes("Unknown column") && msg.includes("password")) {
      try {
        const [rows2] = await pool.query(USER_SQL_PASSWORD_HASH, [username]);
        return rows2 as UserRow[];
      } catch {
        // fallback s nivo_ovlastenja ako treba
        const altHash = `SELECT u.user_id, u.username, u.password_hash AS password, u.role_id,
          COALESCE(r.nivo_ovlastenja, 0) AS nivo_ovlastenja
          FROM users u LEFT JOIN roles r ON r.role_id = u.role_id
          WHERE u.username = ? AND u.aktivan = 1 LIMIT 1`;
        const [rows3] = await pool.query(altHash, [username]);
        return rows3 as UserRow[];
      }
    }
    throw err;
  }
}

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

    const isDemoLogin = username.toLowerCase() === "demo" && password === "demo";
    let poolToUse: Pool;
    let isDemoSession = false;
    if (isDemoLogin) {
      let demoPool = getDemoPoolOrNull();
      if (!demoPool && process.env.DB_NAME?.toLowerCase().includes("demo")) {
        demoPool = getStudioPoolExport();
      }
      if (!demoPool) {
        return NextResponse.json({ ok: false, error: "DEMO_NOT_CONFIGURED" }, { status: 503 });
      }
      poolToUse = demoPool;
      isDemoSession = true;
    } else {
      poolToUse = getStudioPoolExport();
    }

    const loginUsername = isDemoLogin ? "demo" : username;
    let rows: UserRow[];
    try {
      rows = await queryUser(poolToUse, loginUsername);
    } catch (demoErr) {
      if (isDemoLogin) {
        console.error("[auth/login] demo pool query failed:", demoErr);
        return NextResponse.json(
          { ok: false, error: "DEMO_DB_ERROR", message: demoErr instanceof Error ? demoErr.message : String(demoErr) },
          { status: 503 }
        );
      }
      throw demoErr;
    }

    let user = rows?.[0];
    if (!user && isDemoLogin) {
      // Samopopravka: korisnik demo ne postoji – kreiraj ga u demo bazi (bez seeda)
      try {
        const demoHash = await bcrypt.hash("demo", 10);
        const [roleRows] = await poolToUse.query("SELECT role_id FROM roles ORDER BY role_id LIMIT 1");
        const roleRowsTyped = roleRows as { role_id: number }[];
        let roleId = roleRowsTyped?.[0]?.role_id ?? 1;
        if (!roleRowsTyped?.length) {
          try {
            await poolToUse.query(
              "INSERT INTO roles (naziv, nivo_ovlastenja) VALUES ('Demo', 10)"
            ).catch(() => poolToUse.query("INSERT INTO roles (naziv, nivo_ovlascenja) VALUES ('Demo', 10)"));
            const [r] = await poolToUse.query("SELECT role_id FROM roles ORDER BY role_id DESC LIMIT 1");
            roleId = (r as { role_id: number }[])?.[0]?.role_id ?? 1;
          } catch {
            // možda kolona drugačije zove
          }
        }
        try {
          await poolToUse.query(
            "INSERT INTO users (username, password_hash, role_id, aktivan) VALUES ('demo', ?, ?, 1)",
            [demoHash, roleId]
          );
        } catch (insErr: unknown) {
          const m = insErr instanceof Error ? insErr.message : String(insErr);
          if (m.includes("password_hash") || m.includes("Unknown column")) {
            await poolToUse.query(
              "INSERT INTO users (username, password, role_id, aktivan) VALUES ('demo', ?, ?, 1)",
              [demoHash, roleId]
            );
          } else {
            throw insErr;
          }
        }
        const newRows = await queryUser(poolToUse, "demo");
        user = newRows?.[0];
      } catch (insertErr) {
        console.error("[auth/login] demo user create failed:", insertErr);
        return NextResponse.json({ ok: false, error: "DEMO_USER_MISSING" }, { status: 401 });
      }
    }
    if (!user) {
      if (isDemoLogin) {
        return NextResponse.json({ ok: false, error: "DEMO_USER_MISSING" }, { status: 401 });
      }
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

    if (!valid && isDemoLogin) {
      const correctHash = await bcrypt.hash("demo", 10);
      try {
        await poolToUse.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [correctHash, user.user_id]);
      } catch {
        await poolToUse.query("UPDATE users SET password = ? WHERE user_id = ?", [correctHash, user.user_id]).catch(() => null);
      }
      valid = true;
    }
    if (!valid) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    await poolToUse.query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [user.user_id]
    ).catch(() => {});

    const nivo = Number(user.nivo_ovlastenja ?? 0);
    const token = createSessionToken({
      user_id: user.user_id,
      username: user.username,
      role_id: user.role_id,
      nivo,
      isDemo: isDemoSession,
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
