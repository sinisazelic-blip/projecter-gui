// src/app/api/projects/[id]/pro-bono/route.ts
// ProBono: samo owner. Označava projekat koji se nikad ne fakturiše i šalje ga u arhivu.
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
    `SELECT status_id, COALESCE(pro_bono, 0) AS pro_bono FROM projekti WHERE projekat_id = ? LIMIT 1`,
    [projekatId],
  );
  const row = rows?.[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "Projekat nije pronađen." }, { status: 404 });
  }

  const statusId = Number(row.status_id ?? 0);
  const proBono = Number(row.pro_bono ?? 0);

  if (proBono === 1) {
    return NextResponse.json(
      { ok: false, error: "Projekat je već označen kao ProBono." },
      { status: 409 },
    );
  }
  if (statusId === 9) {
    return NextResponse.json(
      { ok: false, error: "Projekat je fakturisan, ProBono nije moguće." },
      { status: 409 },
    );
  }
  if (statusId === 10 || statusId === 11 || statusId === 12) {
    return NextResponse.json(
      { ok: false, error: "Projekat je već arhiviran/otkazan." },
      { status: 409 },
    );
  }

  await query(
    `UPDATE projekti SET pro_bono = 1, status_id = 10 WHERE projekat_id = ? LIMIT 1`,
    [projekatId],
  );

  return NextResponse.json({
    ok: true,
    message: "Projekat je označen kao ProBono i prebačen u arhivu.",
    projekat_id: projekatId,
  });
}
