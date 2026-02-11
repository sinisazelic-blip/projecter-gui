import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req, { params }) {
  try {
    const p = await params;
    const projekatId = Number(p?.id);

    if (!Number.isFinite(projekatId)) {
      return NextResponse.json(
        { success: false, message: "Neispravan projekat_id" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { datum_troska, opis, iznos_km, status = "NASTALO" } = body;

    if (!datum_troska || !opis || !iznos_km) {
      return NextResponse.json(
        { success: false, message: "Nedostaju obavezna polja" },
        { status: 400 },
      );
    }

    await query(
      `
      INSERT INTO projektni_troskovi
        (projekat_id, datum_troska, opis, iznos_km, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [projekatId, datum_troska, opis, iznos_km, status],
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
