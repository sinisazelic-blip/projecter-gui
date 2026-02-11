import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");

    if (!table) {
      return NextResponse.json(
        { success: false, message: "Nedostaje parametar: table" },
        { status: 400 },
      );
    }

    // zaštita (identifikatori se ne mogu parametrizovati)
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      return NextResponse.json(
        { success: false, message: "Neispravan naziv tabele" },
        { status: 400 },
      );
    }

    const columns = await query(`SHOW COLUMNS FROM \`${table}\``);
    return NextResponse.json({ success: true, table, columns });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
