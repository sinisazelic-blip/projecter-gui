import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicijacijaId = Number(searchParams.get("id"));

  if (!Number.isFinite(inicijacijaId) || inicijacijaId <= 0) {
    return NextResponse.json({ ok: false, error: "Neispravan ID" }, { status: 400 });
  }

  const conn = await (pool as any).getConnection();

  try {
    await conn.beginTransaction();

    // 1) Učitaj ponudu
    const [rows] = await conn.query(
      `SELECT * FROM inicijacije WHERE inicijacija_id = ? FOR UPDATE`,
      [inicijacijaId]
    );

    if (!rows || rows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Ponuda ne postoji" }, { status: 404 });
    }

    const inic = rows[0];

    // Ako je već pretvorena
    if (inic.projekat_id) {
      await conn.commit();
      return NextResponse.json({
        ok: true,
        already: true,
        projekat_id: inic.projekat_id,
        sifra: inic.projekat_id,
      });
    }

    // 2) Kreiraj projekat
    const insertResult = await conn.query(
      `INSERT INTO projekti
        (narucilac_id, krajnji_klijent_id, radni_naziv, status_id)
       VALUES (?, ?, ?, ?)`,
      [
        inic.narucilac_id,
        inic.krajnji_klijent_id ?? null,
        inic.radni_naziv,
        1, // default status
      ]
    );

    const okPacket = insertResult[0];
    const projekatId = Number(okPacket.insertId);

    

    // 3) Veži ponudu na projekat
    await conn.query(
      `UPDATE inicijacije
      SET projekat_id = ?
      WHERE inicijacija_id = ?
      AND (projekat_id IS NULL OR projekat_id = 0)`,

      [projekatId, inicijacijaId]
    );

    await conn.commit();

    

    return NextResponse.json({
      ok: true,
      inicijacija_id: inicijacijaId,
      projekat_id: projekatId,
      sifra: projekatId, // 5691, 5692...
    });
    
  } catch (e: any) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
