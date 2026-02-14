// src/app/api/projects/[id]/storno/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const [rows]: any = await query(
    `SELECT status_id FROM projekti WHERE projekat_id = ? LIMIT 1`,
    [projekatId],
  );
  const statusId = Number(rows?.[0]?.status_id ?? 0);

  // Ne dozvoli storno ako je već otkazan/arhiviran/fakturisan
  if (statusId === 9) {
    return NextResponse.json(
      { ok: false, error: "Projekat je fakturisan, storno nije moguće." },
      { status: 409 },
    );
  }
  if (statusId === 10 || statusId === 11 || statusId === 12) {
    return NextResponse.json(
      { ok: false, error: "Projekat je već otkazan/arhiviran." },
      { status: 409 },
    );
  }

  await query(
    `UPDATE projekti SET status_id = 12 WHERE projekat_id = ?`,
    [projekatId],
  );

  return NextResponse.json({
    ok: true,
    message: "Projekat je storniran (Otkazan).",
    projekat_id: projekatId,
  });
}
