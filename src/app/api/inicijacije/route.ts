import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

async function getDefaultStatusIdNovo() {
  const [rows] = await pool.query<any[]>(
    `SELECT status_id
     FROM statusi
     WHERE entitet='inicijacija' AND kod='novo'
     LIMIT 1`,
  );

  if (!rows || rows.length === 0) {
    throw new Error("Status 'inicijacija/novo' ne postoji");
  }
  return rows[0].status_id as number;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const narucilac_id = Number(body.narucilac_id);
  const radni_naziv = (body.radni_naziv ?? "").toString().trim();

  if (!narucilac_id || !radni_naziv) {
    return NextResponse.json(
      { ok: false, error: "narucilac_id i radni_naziv su obavezni" },
      { status: 400 },
    );
  }

  const status_id = body.status_id
    ? Number(body.status_id)
    : await getDefaultStatusIdNovo();

  const [res] = await pool.query<any>(
    `INSERT INTO inicijacije
     (narucilac_id, krajnji_klijent_id, radni_naziv, kontakt_ime, kontakt_tel, kontakt_email, napomena, status_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      narucilac_id,
      body.krajnji_klijent_id ?? null,
      radni_naziv,
      body.kontakt_ime ?? null,
      body.kontakt_tel ?? null,
      body.kontakt_email ?? null,
      body.napomena ?? null,
      status_id,
    ],
  );

  await audit("INIT_CREATED", {
    inicijacija_id: res.insertId,
    narucilac_id,
    status_id,
  });

  return NextResponse.json({ ok: true, inicijacija_id: res.insertId });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [rows] = await pool.query<any[]>(
    `SELECT i.*, s.naziv AS status_naziv, s.kod AS status_kod
     FROM inicijacije i
     JOIN statusi s ON s.status_id = i.status_id
     ORDER BY i.updated_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return NextResponse.json({ ok: true, rows, limit, offset });
}
