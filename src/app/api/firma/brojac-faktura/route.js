// GET: lista godina i zadnji_broj_u_godini iz brojac_faktura (početne vrijednosti / sljedeći broj)
// POST: postavi za godinu (body: { godina, zadnji_broj_u_godini }) — "posljednji izdati broj prije Fluxe"
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool, { query } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return { ok: false, resp: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  return { ok: true, session };
}

export async function GET() {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.resp;

    const rows = await query(
      `SELECT godina, zadnji_broj_u_godini FROM brojac_faktura ORDER BY godina DESC`,
    );
    const items = (rows || []).map((r) => ({
      godina: Number(r.godina),
      zadnji_broj_u_godini: Number(r.zadnji_broj_u_godini) || 0,
    }));

    // Za trenutnu godinu izračunaj sljedeći broj (max iz fakture vs brojac)
    const godina = new Date().getFullYear();
    let sljedeciZaGodinu = null;
    try {
      const [maxFakture] = await pool.query(
        `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?`,
        [godina],
      );
      const maxIzFakture = Number(maxFakture?.[0]?.m ?? 0) || 0;
      const brojacRow = items.find((x) => x.godina === godina);
      const brojacZadnji = brojacRow ? brojacRow.zadnji_broj_u_godini : 0;
      const sledeci = Math.max(maxIzFakture, brojacZadnji) + 1;
      sljedeciZaGodinu = `${String(sledeci).padStart(3, "0")}/${godina}`;
    } catch {
      sljedeciZaGodinu = `001/${godina}`;
    }

    return NextResponse.json({
      ok: true,
      items,
      sljedeci_za_trenutnu_godinu: sljedeciZaGodinu,
      trenutna_godina: godina,
    });
  } catch (e) {
    console.error("GET /api/firma/brojac-faktura", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.resp;

    const body = await req.json().catch(() => ({}));
    const godina = Number(body.godina);
    const zadnji = Number(body.zadnji_broj_u_godini);
    const force = Boolean(body.force);

    if (!Number.isFinite(godina) || godina < 2000 || godina > 2100) {
      return NextResponse.json(
        { ok: false, error: "Godina mora biti između 2000 i 2100." },
        { status: 400 },
      );
    }

    const zadnjiBroj = Math.max(0, Math.floor(zadnji));

    if (force) {
      // ✅ Force: dozvoli i smanjenje (reset) brojača – koristi se kad se obrišu testne fakture.
      await pool.query(
        `INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE zadnji_broj_u_godini = VALUES(zadnji_broj_u_godini)`,
        [godina, zadnjiBroj],
      );
    } else {
      // Default: nikad ne smanjuj brojač (sigurnije u produkciji)
      await pool.query(
        `INSERT INTO brojac_faktura (godina, zadnji_broj_u_godini) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE zadnji_broj_u_godini = GREATEST(zadnji_broj_u_godini, ?)`,
        [godina, zadnjiBroj, zadnjiBroj],
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Za godinu ${godina} postavljeno: posljednji broj ${zadnjiBroj}. Sljedeći broj fakture bit će ${String(zadnjiBroj + 1).padStart(3, "0")}/${godina}.`,
    });
  } catch (e) {
    console.error("POST /api/firma/brojac-faktura", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška snimanja" },
      { status: 500 },
    );
  }
}
