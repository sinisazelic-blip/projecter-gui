import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `
      SELECT TABLE_NAME AS name, TABLE_TYPE AS type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_TYPE, TABLE_NAME
      `
    );

    return NextResponse.json({ success: true, tables: rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
