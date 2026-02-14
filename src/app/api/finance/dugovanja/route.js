import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      projekat_id,
      dobavljac_id,
      talent_id,
      datum,
      datum_dospijeca,
      iznos_km,
      opis,
      napomena,
      status,
    } = body;

    const datumStr = datum ? String(datum).slice(0, 10) : null;
    const dospijecaStr = datum_dospijeca ? String(datum_dospijeca).slice(0, 10) : null;
    const iznos = Number(iznos_km);
    if (!Number.isFinite(iznos) || iznos < 0) {
      return NextResponse.json(
        { ok: false, error: "Iznos (iznos_km) je obavezan i mora biti broj ≥ 0." },
        { status: 400 },
      );
    }
    const opisTrim = opis != null ? String(opis).trim() : null;
    const statusVal = (status && ["CEKA", "PLACENO", "DJELIMICNO", "STORNO"].includes(String(status).toUpperCase()))
      ? String(status).toUpperCase()
      : "CEKA";
    const projId = projekat_id != null && Number.isFinite(Number(projekat_id)) ? Number(projekat_id) : null;
    const dobId = dobavljac_id != null && Number.isFinite(Number(dobavljac_id)) ? Number(dobavljac_id) : null;

    // Kolona talent_id postoji u nekim shemama; ako nema, ukloni je iz INSERT-a
    let res;
    const talId = talent_id != null && Number.isFinite(Number(talent_id)) ? Number(talent_id) : null;
    try {
      res = await query(
        `
        INSERT INTO projekt_dugovanja
          (projekat_id, dobavljac_id, talent_id, datum, datum_dospijeca, iznos_km, opis, napomena, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          projId,
          dobId,
          talId,
          datumStr,
          dospijecaStr,
          iznos,
          opisTrim || null,
          napomena != null ? String(napomena).trim() : null,
          statusVal,
        ],
      );
    } catch (colErr) {
      const msg = String(colErr?.message || "").toLowerCase();
      if (msg.includes("talent_id") || msg.includes("unknown column")) {
        res = await query(
          `
          INSERT INTO projekt_dugovanja
            (projekat_id, dobavljac_id, datum, datum_dospijeca, iznos_km, opis, napomena, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projId,
            dobId,
            datumStr,
            dospijecaStr,
            iznos,
            opisTrim || null,
            napomena != null ? String(napomena).trim() : null,
            statusVal,
          ],
        );
      } else {
        throw colErr;
      }
    }

    const id = res?.insertId ?? null;
    return NextResponse.json({ ok: true, dugovanje_id: id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
