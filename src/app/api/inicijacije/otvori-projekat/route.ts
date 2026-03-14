import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function hasColumn(
  conn: any,
  table: string,
  column: string,
): Promise<boolean> {
  try {
    const [rows]: any = await conn.query(
      `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

// DATETIME (string ili Date) -> "YYYY-MM-DD"
function toISODateOnly(v: any): string | null {
  if (!v) return null;

  if (v instanceof Date && Number.isFinite(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  const s = String(v);
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return null;
}

async function ensureProjectSnapshot(
  conn: any,
  projekat_id: number,
  inicijacija_id: number,
) {
  const [crows]: any = await conn.query(
    `SELECT COUNT(*) AS cnt FROM projekat_stavke WHERE projekat_id = ?`,
    [projekat_id],
  );
  const cnt = Number(crows?.[0]?.cnt ?? 0);
  if (cnt > 0) return { inserted: 0, alreadyHad: true };

  const hasStorno = await hasColumn(conn, "inicijacija_stavke", "stornirano");

  const [res]: any = await conn.query(
    `
    INSERT INTO projekat_stavke
      (projekat_id, inicijacija_id, inicijacija_stavka_id, naziv, opis, kolicina, cijena_jedinicna, valuta, line_total)
    SELECT
      ?, s.inicijacija_id,
      s.inicijacija_stavka_id,
      s.naziv_snapshot,
      s.opis,
      s.kolicina,
      s.cijena_jedinicna,
      COALESCE(NULLIF(TRIM(UPPER(s.valuta)), ''), 'BAM') AS valuta,
      ROUND(s.kolicina * s.cijena_jedinicna, 2) AS line_total
    FROM inicijacija_stavke s
    WHERE s.inicijacija_id = ?
      ${hasStorno ? "AND s.stornirano = 0" : ""}
    `,
    [projekat_id, inicijacija_id],
  );

  return { inserted: Number(res?.affectedRows ?? 0), alreadyHad: false };
}

async function ensureProjectMeta(
  conn: any,
  projekat_id: number,
  meta: { rok_glavni: string | null; napomena: string | null; account_manager_radnik_id?: number | null },
) {
  const am = meta.account_manager_radnik_id;
  const hasAmCol = await hasColumn(conn, "projekti", "account_manager_radnik_id");
  const useAm = hasAmCol && am != null;
  const [res]: any = await conn.query(
    useAm
      ? `
    UPDATE projekti
    SET
      rok_glavni = COALESCE(rok_glavni, ?),
      napomena   = COALESCE(napomena, ?),
      account_manager_radnik_id = COALESCE(account_manager_radnik_id, ?)
    WHERE projekat_id = ?
    LIMIT 1
    `
      : `
    UPDATE projekti
    SET
      rok_glavni = COALESCE(rok_glavni, ?),
      napomena   = COALESCE(napomena, ?)
    WHERE projekat_id = ?
    LIMIT 1
    `,
    useAm ? [meta.rok_glavni, meta.napomena, am, projekat_id] : [meta.rok_glavni, meta.napomena, projekat_id],
  );
  return { updated: Number(res?.affectedRows ?? 0) };
}

export async function POST(req: NextRequest) {
  const conn = await (pool as any).getConnection();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const session = token ? verifySessionToken(token) : null;
    let accountManagerRadnikId: number | null = null;
    if (session?.user_id) {
      const [urows]: any = await conn.query(
        `SELECT radnik_id FROM users WHERE user_id = ? LIMIT 1`,
        [session.user_id],
      );
      accountManagerRadnikId =
        urows?.[0]?.radnik_id != null ? Number(urows[0].radnik_id) : null;
    }

    const body = await req.json().catch(() => ({}));
    const inicijacija_id = asInt(body?.inicijacija_id);

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "inicijacija_id je obavezan." },
        { status: 400 },
      );
    }

    await conn.beginTransaction();

    const [irows]: any = await conn.query(
      `
      SELECT inicijacija_id, radni_naziv, projekat_id, narucilac_id, krajnji_klijent_id, napomena
      FROM inicijacije
      WHERE inicijacija_id = ?
      FOR UPDATE
      `,
      [inicijacija_id],
    );

    const inic = Array.isArray(irows) && irows.length ? irows[0] : null;
    if (!inic) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Deal nije pronađen." },
        { status: 404 },
      );
    }

    if (!inic.narucilac_id) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error:
            "Deal nema naručioca (narucilac_id). Ne mogu otvoriti projekat.",
        },
        { status: 400 },
      );
    }

    const [trows]: any = await conn.query(
      `
      SELECT accepted_deadline
      FROM deal_timeline_events
      WHERE inicijacija_id = ?
      ORDER BY created_at DESC, event_id DESC
      LIMIT 1
      `,
      [inicijacija_id],
    );

    const t = Array.isArray(trows) && trows.length ? trows[0] : null;
    if (!t || !t.accepted_deadline) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ne može se otvoriti projekat bez prihvaćenog roka (Timeline).",
        },
        { status: 400 },
      );
    }

    const acceptedDate = toISODateOnly(t.accepted_deadline);

    const meta = {
      rok_glavni: acceptedDate,
      napomena: inic.napomena ?? null,
      account_manager_radnik_id: accountManagerRadnikId,
    };

    if (inic.projekat_id) {
      const projekat_id = Number(inic.projekat_id);

      const metaRes = await ensureProjectMeta(conn, projekat_id, meta);
      const snap = await ensureProjectSnapshot(
        conn,
        projekat_id,
        inicijacija_id,
      );

      await conn.commit();
      return NextResponse.json({
        ok: true,
        projekat_id,
        meta: metaRes,
        snapshot: snap,
      });
    }

    const [mrows]: any = await conn.query(
      `SELECT COALESCE(MAX(projekat_id), 0) AS mx FROM projekti`,
    );
    const nextId = Number(mrows?.[0]?.mx ?? 0) + 1;

    const hasAmCol = await hasColumn(conn, "projekti", "account_manager_radnik_id");
    await conn.query(
      hasAmCol
        ? `
      INSERT INTO projekti
        (projekat_id, id_po, status_id, radni_naziv,
         narucilac_id, krajnji_klijent_id,
         tip_roka, rok_glavni, napomena, budzet_procenat_za_tim, account_manager_radnik_id)
      VALUES
        (?, ?, ?, ?,
         ?, ?,
         'deadline', ?, ?, ?, ?)
      `
        : `
      INSERT INTO projekti
        (projekat_id, id_po, status_id, radni_naziv,
         narucilac_id, krajnji_klijent_id,
         tip_roka, rok_glavni, napomena, budzet_procenat_za_tim)
      VALUES
        (?, ?, ?, ?,
         ?, ?,
         'deadline', ?, ?, ?)
      `,
      hasAmCol
        ? [
            nextId,
            nextId,
            3,
            inic.radni_naziv,
            inic.narucilac_id,
            inic.krajnji_klijent_id ?? null,
            meta.rok_glavni,
            meta.napomena,
            100.0,
            accountManagerRadnikId,
          ]
        : [
            nextId,
            nextId,
            3,
            inic.radni_naziv,
            inic.narucilac_id,
            inic.krajnji_klijent_id ?? null,
            meta.rok_glavni,
            meta.napomena,
            100.0,
          ],
    );

    await conn.query(
      `UPDATE inicijacije SET projekat_id = ? WHERE inicijacija_id = ?`,
      [nextId, inicijacija_id],
    );

    const snap = await ensureProjectSnapshot(conn, nextId, inicijacija_id);

    await conn.commit();
    return NextResponse.json({
      ok: true,
      projekat_id: nextId,
      meta: { ok: true },
      snapshot: snap,
    });
  } catch (e: any) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  } finally {
    try {
      conn.release();
    } catch {}
  }
}
