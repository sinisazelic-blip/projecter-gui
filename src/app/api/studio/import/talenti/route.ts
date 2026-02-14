import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseXlsxToRows } from "@/lib/import-xlsx";
import { revalidatePath } from "next/cache";

const VRISTE = ["spiker", "glumac", "pjevac", "dijete", "muzicar", "ostalo"] as const;

function str(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function cleanStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function vrsta(v: unknown): (typeof VRISTE)[number] {
  const s = String(v ?? "").trim().toLowerCase();
  if (
    s === "spiker" ||
    s === "glumac" ||
    s === "pjevac" ||
    s === "dijete" ||
    s === "muzicar"
  )
    return s;
  return "ostalo";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Nema fajla (polje 'file')" },
        { status: 400 },
      );
    }
    const buf = await file.arrayBuffer();
    const rows = parseXlsxToRows(buf);
    if (!rows.length) {
      return NextResponse.json(
        { ok: true, imported: 0, errors: [], message: "Nema redova za uvoz." },
      );
    }

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      try {
        const ime_prezime = str(r, "ime_prezime");
        if (!ime_prezime) throw new Error("ime_prezime je obavezno.");

        const vrstaVal = vrsta(r.vrsta);
        const email = cleanStr(r.email);
        const telefon = cleanStr(r.telefon);
        const napomena = cleanStr(r.napomena);
        const aktivan = r.aktivan === false || r.aktivan === 0 || r.aktivan === "0" ? 0 : 1;

        await query(
          `INSERT INTO talenti (ime_prezime, vrsta, email, telefon, napomena, aktivan, created_at, updated_at)
           VALUES (?,?,?,?,?,?, NOW(), NOW())`,
          [ime_prezime, vrstaVal, email, telefon, napomena, aktivan],
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, message });
      }
    }

    revalidatePath("/studio/talenti");
    return NextResponse.json({
      ok: true,
      imported,
      total: rows.length,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
