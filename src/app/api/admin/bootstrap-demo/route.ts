import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDemoPoolOrNull, getStudioPoolExport } from "@/lib/db";

/**
 * Jednokratno kreiranje/ispravljanje demo usera u demo bazi (na DO ili lokalno).
 * Poziv: GET /api/admin/bootstrap-demo?token=TVOJ_BOOTSTRAP_SECRET
 *
 * U .env dodaj: BOOTSTRAP_DEMO_SECRET=neki_tajni_string (min 16 znakova)
 * Na DO postavi tu env varijablu, pa jednom otvori npr.:
 * https://app.studiotaf.xyz/api/admin/bootstrap-demo?token=neki_tajni_string
 *
 * Vraća JSON sa statusom. Nakon toga demo/demo login bi trebao raditi.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.BOOTSTRAP_DEMO_SECRET;

  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "BOOTSTRAP_DEMO_SECRET nije postavljen u env (min 16 znakova)." },
      { status: 503 }
    );
  }
  if (token !== secret) {
    return NextResponse.json({ ok: false, error: "Neispravan token." }, { status: 403 });
  }

  let pool = getDemoPoolOrNull();
  if (!pool && process.env.DB_NAME?.toLowerCase().includes("demo")) {
    pool = getStudioPoolExport();
  }
  if (!pool) {
    return NextResponse.json(
      { ok: false, error: "Demo baza nije dostupna. Postavi DEMO_DB_NAME (ili DB_NAME sa 'demo')." },
      { status: 503 }
    );
  }

  try {
    const hash = await bcrypt.hash("demo", 10);

    const [roleRows] = await pool.query("SELECT role_id FROM roles ORDER BY role_id LIMIT 1");
    const roleRowsTyped = roleRows as { role_id: number }[];
    let roleId = roleRowsTyped?.[0]?.role_id ?? 1;
    if (!roleRowsTyped?.length) {
      try {
        await pool.query(
          "INSERT INTO roles (naziv, nivo_ovlastenja) VALUES ('Demo', 10)"
        ).catch(() => pool!.query("INSERT INTO roles (naziv, nivo_ovlascenja) VALUES ('Demo', 10)"));
        const [r] = await pool.query("SELECT role_id FROM roles ORDER BY role_id DESC LIMIT 1");
        roleId = (r as { role_id: number }[])?.[0]?.role_id ?? 1;
      } catch {
        // ignore
      }
    }

    const [existing] = await pool.query("SELECT user_id FROM users WHERE username = 'demo' LIMIT 1");
    const existingTyped = existing as { user_id: number }[];

    if (existingTyped?.length) {
      try {
        await pool.query("UPDATE users SET password_hash = ?, role_id = ?, aktivan = 1 WHERE username = 'demo'", [
          hash,
          roleId,
        ]);
      } catch {
        await pool.query("UPDATE users SET password = ?, role_id = ?, aktivan = 1 WHERE username = 'demo'", [
          hash,
          roleId,
        ]);
      }
      return NextResponse.json({
        ok: true,
        message: "Korisnik demo ažuriran. Sada probaj demo/demo ili Pogledaj demo.",
      });
    }

    try {
      await pool.query(
        "INSERT INTO users (username, password_hash, role_id, aktivan) VALUES ('demo', ?, ?, 1)",
        [hash, roleId]
      );
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes("password_hash") || msg.includes("Unknown column")) {
        await pool.query(
          "INSERT INTO users (username, password, role_id, aktivan) VALUES ('demo', ?, ?, 1)",
          [hash, roleId]
        );
      } else {
        throw e;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Korisnik demo kreiran. Sada probaj demo/demo ili Pogledaj demo.",
    });
  } catch (err) {
    console.error("[bootstrap-demo]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
