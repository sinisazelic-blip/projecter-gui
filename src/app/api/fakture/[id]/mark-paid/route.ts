// src/app/api/fakture/[id]/mark-paid/route.ts
// Ručno označavanje fakture kao naplaćene (fiskalni_status = PLACENA).
// Koristi se kada je uplata primljena (npr. izvod / keš), a nije automatski povezana s fakturom.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fakturaId = Number(id);

    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ID fakture" },
        { status: 400 }
      );
    }

    const rows = await query(
      `SELECT faktura_id, fiskalni_status FROM fakture WHERE faktura_id = ? LIMIT 1`,
      [fakturaId]
    );
    const row = Array.isArray(rows) ? rows[0] : (rows as any)?.rows?.[0];

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Faktura nije pronađena" },
        { status: 404 }
      );
    }

    const status = String(row.fiskalni_status ?? "").toUpperCase();
    if (status === "PLACENA") {
      return NextResponse.json({ ok: true, already_paid: true });
    }
    if (status === "STORNIRAN" || status === "ZAMIJENJEN") {
      return NextResponse.json(
        { ok: false, error: "Stornirana ili zamijenjena faktura ne može se označiti kao naplaćena." },
        { status: 400 }
      );
    }

    await query(
      `UPDATE fakture SET fiskalni_status = 'PLACENA' WHERE faktura_id = ?`,
      [fakturaId]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[mark-paid]", e?.message);
    return NextResponse.json(
      { ok: false, error: e?.message || "Greška pri ažuriranju" },
      { status: 500 }
    );
  }
}
