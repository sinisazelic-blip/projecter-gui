import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST() {
  try {
    const projekatId = 5691;

    const result = await query(
      `
      UPDATE projekti
      SET
        radni_naziv = ?,
        budzet_planirani = ?
      WHERE projekat_id = ?
      `,
      ["Testni projekat", 100.0, projekatId]
    );

    // provjeri šta sad piše
    const rows = await query(
      `SELECT projekat_id, radni_naziv, budzet_planirani FROM projekti WHERE projekat_id = ? LIMIT 1`,
      [projekatId]
    );

    return NextResponse.json({ success: true, updated: result, after: rows?.[0] ?? null });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
