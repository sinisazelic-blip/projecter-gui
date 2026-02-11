import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const qRaw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = qRaw.slice(0, 50);

  if (!q) {
    return NextResponse.json({ success: true, data: [] });
  }

  const isNum = /^[0-9]+$/.test(q);

  // Ako je broj: traži projekat_id koji počinje sa q
  // Ako nije broj: traži po nazivu (radni_naziv LIKE %q%)
  const rows = isNum
    ? await query(
        `
        SELECT projekat_id, radni_naziv
        FROM projekti
        WHERE CAST(projekat_id AS CHAR) LIKE CONCAT(?, '%')
        ORDER BY projekat_id ASC
        LIMIT 20
        `,
        [q],
      )
    : await query(
        `
        SELECT projekat_id, radni_naziv
        FROM projekti
        WHERE radni_naziv LIKE CONCAT('%', ?, '%')
        ORDER BY projekat_id DESC
        LIMIT 20
        `,
        [q],
      );

  return NextResponse.json({ success: true, data: rows });
}
