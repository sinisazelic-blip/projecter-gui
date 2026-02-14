import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PATCH: Ažuriraj fazu
 * DELETE: Obriši fazu
 */
export async function PATCH(req, { params }) {
  const { id, fazaId } = await params;
  const projekatId = Number(id);
  const projekatFazaId = Number(fazaId);
  if (!Number.isFinite(projekatId) || !Number.isFinite(projekatFazaId))
    return NextResponse.json({ ok: false, error: "Neispravan ID" }, { status: 400 });

  try {
    const body = await req.json();

    const sets = [];
    const vals = [];

    if (body.faza_id !== undefined) {
      sets.push("faza_id = ?");
      vals.push(body.faza_id ? Number(body.faza_id) : null);
    }
    if (body.naziv !== undefined) {
      sets.push("naziv = ?");
      vals.push(body.naziv ? String(body.naziv).trim() : null);
    }
    if (body.datum_pocetka !== undefined) {
      sets.push("datum_pocetka = ?");
      vals.push(body.datum_pocetka ? String(body.datum_pocetka).slice(0, 10) : null);
    }
    if (body.datum_kraja !== undefined) {
      sets.push("datum_kraja = ?");
      vals.push(body.datum_kraja ? String(body.datum_kraja).slice(0, 10) : null);
    }
    if (body.deadline !== undefined) {
      sets.push("deadline = ?");
      vals.push(body.deadline ? String(body.deadline).slice(0, 10) : null);
    }
    if (body.procenat_izvrsenosti !== undefined) {
      const p = Math.min(100, Math.max(0, Number(body.procenat_izvrsenosti) || 0));
      sets.push("procenat_izvrsenosti = ?");
      vals.push(p);
    }
    if (body.redoslijed !== undefined) {
      sets.push("redoslijed = ?");
      vals.push(Number(body.redoslijed) || 0);
    }
    if (body.napomena !== undefined) {
      sets.push("napomena = ?");
      vals.push(body.napomena ? String(body.napomena).trim() : null);
    }

    if (sets.length === 0)
      return NextResponse.json({ ok: true, message: "Nema izmjena" });

    const [proj] = await query(
      `SELECT DATE_FORMAT(rok_glavni, '%Y-%m-%d') AS rok_glavni FROM projekti WHERE projekat_id = ? LIMIT 1`,
      [projekatId]
    );
    const rokGlavni = proj?.rok_glavni ? String(proj.rok_glavni).trim() : null;
    if (rokGlavni) {
      const deadlineVal = body.deadline !== undefined ? (body.deadline ? String(body.deadline).slice(0, 10) : null) : null;
      const datumKrajaVal = body.datum_kraja !== undefined ? (body.datum_kraja ? String(body.datum_kraja).slice(0, 10) : null) : null;
      if (deadlineVal && deadlineVal > rokGlavni)
        return NextResponse.json({ ok: false, error: `Deadline faze ne smije biti poslije deadline-a projekta (${rokGlavni}).` }, { status: 400 });
      if (datumKrajaVal && datumKrajaVal > rokGlavni)
        return NextResponse.json({ ok: false, error: `Datum kraja faze ne smije biti poslije deadline-a projekta (${rokGlavni}).` }, { status: 400 });
    }

    vals.push(projekatFazaId, projekatId);
    await query(
      `UPDATE projekat_faze SET ${sets.join(", ")} WHERE projekat_faza_id = ? AND projekat_id = ?`,
      vals
    );

    if (Array.isArray(body.dobavljac_ids)) {
      await query(`DELETE FROM projekat_faza_dobavljaci WHERE projekat_faza_id = ?`, [projekatFazaId]).catch(() => {}); // Ignore ako tabela ne postoji
      for (const did of body.dobavljac_ids.filter(Boolean)) {
        await query(
          `INSERT IGNORE INTO projekat_faza_dobavljaci (projekat_faza_id, dobavljac_id) VALUES (?, ?)`,
          [projekatFazaId, Number(did)]
        ).catch(() => {}); // Ignore ako tabela ne postoji
      }
    }

    if (Array.isArray(body.radnik_ids)) {
      await query(`DELETE FROM projekat_faza_radnici WHERE projekat_faza_id = ?`, [projekatFazaId]);
      for (const rid of body.radnik_ids.filter(Boolean)) {
        await query(
          `INSERT IGNORE INTO projekat_faza_radnici (projekat_faza_id, radnik_id) VALUES (?, ?)`,
          [projekatFazaId, Number(rid)]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { id, fazaId } = await params;
  const projekatId = Number(id);
  const projekatFazaId = Number(fazaId);
  if (!Number.isFinite(projekatId) || !Number.isFinite(projekatFazaId))
    return NextResponse.json({ ok: false, error: "Neispravan ID" }, { status: 400 });

  try {
    await query(
      `DELETE FROM projekat_faze WHERE projekat_faza_id = ? AND projekat_id = ?`,
      [projekatFazaId, projekatId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška" },
      { status: 500 }
    );
  }
}
