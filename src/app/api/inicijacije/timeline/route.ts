import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// prihvati: null, "", "2026-01-29T10:15", "2026-01-29T10:15:00", "2026-01-29 10:15:00"
function toMySqlDateTime(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  // ako je datetime-local: YYYY-MM-DDTHH:mm ili sa sekundama
  if (s.includes("T")) {
    const [d, tRaw] = s.split("T");
    if (!d || !tRaw) return null;
    const t = tRaw.length === 5 ? `${tRaw}:00` : tRaw; // dodaj sekunde ako nema
    return `${d} ${t}`.slice(0, 19);
  }

  // ako već ima space
  if (s.includes(" ")) {
    // ako je bez sekundi
    if (s.length === 16) return `${s}:00`;
    return s.slice(0, 19);
  }

  // samo datum? (ne preporučujem, ali neka bude tolerantno)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s} 00:00:00`;
  }

  return null;
}

async function getProjekatId(inicijacija_id: number): Promise<number> {
  const [r1]: any = await pool.query(
    `SELECT projekat_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id],
  );
  const pid =
    Array.isArray(r1) && r1.length ? Number(r1[0]?.projekat_id ?? 0) : 0;
  return pid > 0 ? pid : 0;
}

/**
 * FAZA 2 (CORE, minimalno v1):
 * Ako postoji projekat i novi accepted_deadline je unesen,
 * projekat mora reflektovati zadnji prihvaćeni rok.
 */
async function resyncProjectDeadlineIfNeeded(
  projekat_id: number,
  accepted_deadline: string | null,
) {
  if (!projekat_id || projekat_id <= 0) return { didResync: false };
  if (!accepted_deadline) return { didResync: false };

  // Minimalno: upiši novi rok u projekat (projekat čita rok iz projekti.rok_glavni)
  await pool.query(
    `
    UPDATE projekti
    SET rok_glavni = ?, tip_roka = 'deadline'
    WHERE projekat_id = ?
    LIMIT 1
    `,
    [accepted_deadline, projekat_id],
  );

  return { didResync: true, projekat_id, rok_glavni: accepted_deadline };
}

/**
 * FAZA 1 (MUST):
 * - touch inicijacije.updated_at
 * - revalidate Deal
 * - revalidate Projects (ako postoji projekat)
 */
async function touchDeal(inicijacija_id: number, projekat_id?: number) {
  await pool.query(
    `UPDATE inicijacije SET updated_at = NOW() WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id],
  );

  revalidatePath(`/inicijacije/${inicijacija_id}`);
  revalidatePath(`/inicijacije`);

  if (projekat_id && projekat_id > 0) {
    revalidatePath(`/projects/${projekat_id}`);
    revalidatePath(`/projects`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicijacija_id = asInt(searchParams.get("inicijacija_id"));

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "inicijacija_id je obavezan." },
        { status: 400 },
      );
    }

    const [rows]: any = await pool.query(
      `
      SELECT
  event_id,
  inicijacija_id,
  DATE_FORMAT(required_deadline, '%Y-%m-%d %H:%i:%s') AS required_deadline,
  DATE_FORMAT(studio_estimate,   '%Y-%m-%d %H:%i:%s') AS studio_estimate,
  DATE_FORMAT(accepted_deadline, '%Y-%m-%d %H:%i:%s') AS accepted_deadline,
  confirmed_via,
  DATE_FORMAT(confirmed_at, '%Y-%m-%d %H:%i:%s') AS confirmed_at,
  note,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
FROM deal_timeline_events
      WHERE inicijacija_id = ?
      ORDER BY created_at DESC, event_id DESC
      LIMIT 1
      `,
      [inicijacija_id],
    );

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const inicijacija_id = asInt(body?.inicijacija_id);
    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "inicijacija_id je obavezan." },
        { status: 400 },
      );
    }

    const required_deadline = toMySqlDateTime(body?.required_deadline);
    const studio_estimate = toMySqlDateTime(body?.studio_estimate);
    const accepted_deadline = toMySqlDateTime(body?.accepted_deadline);

    const confirmed_viaRaw = (body?.confirmed_via ?? null) as string | null;
    const confirmed_via =
      confirmed_viaRaw && String(confirmed_viaRaw).trim()
        ? String(confirmed_viaRaw).trim()
        : null;

    const confirmed_at = toMySqlDateTime(body?.confirmed_at);
    const noteRaw = body?.note ?? null;
    const note =
      noteRaw && String(noteRaw).trim()
        ? String(noteRaw).trim().slice(0, 500)
        : null;

    const [res]: any = await pool.query(
      `
      INSERT INTO deal_timeline_events
      (inicijacija_id, required_deadline, studio_estimate, accepted_deadline, confirmed_via, confirmed_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        inicijacija_id,
        required_deadline,
        studio_estimate,
        accepted_deadline,
        confirmed_via,
        confirmed_at,
        note,
      ],
    );

    // FAZA 2: resync roka u projekat (samo ako postoji projekat + accepted_deadline)
    const projekat_id = await getProjekatId(inicijacija_id);
    const resync = await resyncProjectDeadlineIfNeeded(
      projekat_id,
      accepted_deadline,
    );

    // FAZA 1: touch + revalidate (deal + projects ako postoji)
    await touchDeal(inicijacija_id, projekat_id);

    return NextResponse.json({
      ok: true,
      event_id: res?.insertId ?? null,
      resync,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
