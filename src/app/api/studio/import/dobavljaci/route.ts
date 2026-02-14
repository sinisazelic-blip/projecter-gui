import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseXlsxToRows } from "@/lib/import-xlsx";
import { revalidatePath } from "next/cache";

const VRISTE = ["studio", "freelancer", "servis", "ostalo"] as const;

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
  if (s === "studio" || s === "freelancer" || s === "servis") return s;
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
        const naziv = str(r, "naziv");
        if (!naziv) throw new Error("naziv je obavezan.");

        const vrstaVal = vrsta(r.vrsta);
        const pravno_lice =
          r.pravno_lice === false || r.pravno_lice === 0 || r.pravno_lice === "0"
            ? 0
            : 1;
        const drzava_iso2 = cleanStr(r.drzava_iso2);
        const grad = cleanStr(r.grad);
        const postanski_broj = cleanStr(r.postanski_broj);
        const adresa = cleanStr(r.adresa);
        const email = cleanStr(r.email);
        const telefon = cleanStr(r.telefon);
        const napomena = cleanStr(r.napomena);
        const aktivan =
          r.aktivan === false || r.aktivan === 0 || r.aktivan === "0" ? 0 : 1;

        await query(
          `INSERT INTO dobavljaci
            (naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj, email, telefon, adresa, napomena, aktivan, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
          [
            naziv,
            vrstaVal,
            pravno_lice,
            drzava_iso2,
            grad,
            postanski_broj,
            email,
            telefon,
            adresa,
            napomena,
            aktivan,
          ],
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, message });
      }
    }

    revalidatePath("/studio/dobavljaci");
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
