import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseXlsxToRows } from "@/lib/import-xlsx";
import { revalidatePath } from "next/cache";

const JEDINICE = ["KOM", "SAT", "MIN", "PAKET", "DAN", "OSTALO"];

function str(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normValuta(s: string): string {
  const v = s.toUpperCase();
  if (!v) return "BAM";
  if (v === "KM") return "BAM";
  return v.slice(0, 3);
}

function parseNum(input: unknown): number {
  const n = Number(String(input ?? "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Mora biti broj.");
  if (n < 0) throw new Error("Ne moze biti negativno.");
  return Math.round(n * 100) / 100;
}

function parseNumOrNull(input: unknown): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("INO cijena mora biti broj.");
  if (n < 0) throw new Error("INO cijena ne moze biti negativna.");
  return Math.round(n * 100) / 100;
}

function toActive(v: unknown): number {
  if (v === false || v === 0 || v === "0") return 0;
  return 1;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Nema fajla (polje file)" },
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
        if (naziv.length > 255) throw new Error("naziv max 255.");

        const jedinica = str(r, "jedinica").toUpperCase() || "KOM";
        if (!JEDINICE.includes(jedinica))
          throw new Error("jedinica: " + JEDINICE.join(", "));

        const cijena_default = parseNum(r.cijena_default);
        const valuta_default = normValuta(str(r, "valuta_default"));
        const cijena_ino_eur = parseNumOrNull(r.cijena_ino_eur);
        const active = toActive(r.active);

        await query(
          `INSERT INTO cjenovnik_stavke
            (naziv, jedinica, cijena_default, cijena_ino_eur, valuta_default, sort_order, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1000, ?, NOW(), NOW())`,
          [naziv, jedinica, cijena_default, cijena_ino_eur, valuta_default, active],
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, message });
      }
    }

    revalidatePath("/studio/cjenovnik");
    return NextResponse.json({
      ok: true,
      imported,
      total: rows.length,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
