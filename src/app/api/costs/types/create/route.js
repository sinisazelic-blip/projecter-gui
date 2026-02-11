import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();

    const projekat_id = Number(body?.projekat_id);
    const tip_id = Number(body?.tip_id);
    const iznos_km = Number(String(body?.iznos_km ?? "").replace(",", "."));
    const opis = String(body?.opis ?? "").trim();

    if (!projekat_id || !tip_id || !Number.isFinite(iznos_km)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Nedostaju obavezna polja (projekat, tip, iznos).",
        },
        { status: 400 },
      );
    }

    const tipRows = await query(
      `SELECT requires_entity FROM tip_troska WHERE tip_id=? AND aktivan=1`,
      [tip_id],
    );
    if (!tipRows?.length) {
      return NextResponse.json(
        { ok: false, message: "Neispravan tip troška." },
        { status: 400 },
      );
    }

    const requires = tipRows[0].requires_entity; // 'NONE' | 'TALENT' | 'DOBAVLJAC'

    let entitet_tip = null;
    let entitet_id = null;

    if (requires !== "NONE") {
      entitet_tip = requires;
      entitet_id = Number(body?.entitet_id);
      if (!entitet_id) {
        return NextResponse.json(
          {
            ok: false,
            message:
              requires === "TALENT"
                ? "Za ovaj tip moraš izabrati talenta."
                : "Za ovaj tip moraš izabrati dobavljača.",
          },
          { status: 400 },
        );
      }
    }

    const r = await query(
      `
      INSERT INTO projektni_troskovi
        (projekat_id, tip_id, iznos_km, opis, entitet_tip, entitet_id, status)
      VALUES
        (?, ?, ?, ?, ?, ?, 'AKTIVNO')
      `,
      [projekat_id, tip_id, iznos_km, opis || null, entitet_tip, entitet_id],
    );

    return NextResponse.json({ ok: true, id: r.insertId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
