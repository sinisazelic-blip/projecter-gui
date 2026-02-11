import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "Neispravan ID" },
      { status: 400 },
    );
  }

  const [rows] = await pool.query<any[]>(
    `SELECT i.*, s.naziv AS status_naziv, s.kod AS status_kod
     FROM inicijacije i
     JOIN statusi s ON s.status_id = i.status_id
     WHERE i.inicijacija_id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nije pronađeno" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, row: rows[0] });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "Neispravan ID" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const narucilac_id = Number(body.narucilac_id);
  const radni_naziv = (body.radni_naziv ?? "").toString().trim();
  const status_id = Number(body.status_id);

  if (
    !Number.isFinite(narucilac_id) ||
    narucilac_id <= 0 ||
    !radni_naziv ||
    !Number.isFinite(status_id) ||
    status_id <= 0
  ) {
    return NextResponse.json(
      { ok: false, error: "narucilac_id, radni_naziv i status_id su obavezni" },
      { status: 400 },
    );
  }

  const [res] = await pool.query<any>(
    `UPDATE inicijacije
     SET narucilac_id=?,
         krajnji_klijent_id=?,
         radni_naziv=?,
         kontakt_ime=?,
         kontakt_tel=?,
         kontakt_email=?,
         napomena=?,
         status_id=?
     WHERE inicijacija_id=?`,
    [
      narucilac_id,
      body.krajnji_klijent_id ?? null,
      radni_naziv,
      body.kontakt_ime ?? null,
      body.kontakt_tel ?? null,
      body.kontakt_email ?? null,
      body.napomena ?? null,
      status_id,
      id,
    ],
  );

  if (res.affectedRows === 0) {
    return NextResponse.json(
      { ok: false, error: "Nije pronađeno" },
      { status: 404 },
    );
  }

  await audit("INIT_UPDATED", {
    inicijacija_id: id,
    narucilac_id,
    status_id,
  });

  return NextResponse.json({ ok: true, inicijacija_id: id });
}
