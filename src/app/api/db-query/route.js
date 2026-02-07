import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function bad(msg, status = 400) {
  return NextResponse.json({ success: false, message: msg }, { status });
}

export async function GET(req) {
  // DEV only sigurnosna blokada (da ovo nikad ne ostane otvoreno u produkciji)
  if (process.env.NODE_ENV !== "development") {
    return bad("Not allowed", 403);
  }

  const { searchParams } = new URL(req.url);
  const sqlRaw = searchParams.get("sql") || "";

  const sql = sqlRaw.trim();

  if (!sql) return bad("Nedostaje sql parametar");
  if (sql.length > 2000) return bad("SQL je predugačak");

  // Minimalna zaštita: samo SELECT, bez ;, bez DDL/DML
  const upper = sql.toUpperCase();
  if (!upper.startsWith("SELECT")) return bad("Dozvoljen je samo SELECT");
  if (sql.includes(";")) return bad("Bez ';' (samo jedan upit)");
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "REPLACE"];
  if (forbidden.some((k) => upper.includes(k))) return bad("Zabranjene SQL naredbe");

  // Limit da se ne ubije server
  const finalSql = upper.includes(" LIMIT ") ? sql : `${sql} LIMIT 100`;

  try {
    const rows = await query(finalSql);
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
