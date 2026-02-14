import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseXlsxToRows } from "@/lib/import-xlsx";
import { revalidatePath } from "next/cache";

function str(r: Record<string, unknown>, key: string): string {
  const v = r[key];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function cleanStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanInt(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function tip(v: unknown): "direktni" | "agencija" {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "agencija" ? "agencija" : "direktni";
}

function toBit(v: unknown): 0 | 1 {
  return v === true || v === 1 || v === "1" || v === "da" ? 1 : 0;
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
        const naziv_klijenta = str(r, "naziv_klijenta");
        if (!naziv_klijenta) throw new Error("naziv_klijenta je obavezan.");

        const tip_klijenta = tip(r.tip_klijenta);
        const porezni_id = cleanStr(r.porezni_id);
        const adresa = cleanStr(r.adresa);
        const grad = cleanStr(r.grad);
        const drzava = cleanStr(r.drzava);
        const rok_placanja_dana = cleanInt(r.rok_placanja_dana);
        const napomena = cleanStr(r.napomena);
        const aktivan =
          r.aktivan === false || r.aktivan === 0 || r.aktivan === "0" ? 0 : 1;
        const is_ino = toBit(r.is_ino);
        const pdv_oslobodjen = toBit(r.pdv_oslobodjen);
        const pdv_oslobodjen_napomena = cleanStr(r.pdv_oslobodjen_napomena);

        await query(
          `INSERT INTO klijenti
            (naziv_klijenta, tip_klijenta, porezni_id, adresa, grad, drzava, rok_placanja_dana, napomena, aktivan, is_ino, pdv_oslobodjen, pdv_oslobodjen_napomena, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
          [
            naziv_klijenta,
            tip_klijenta,
            porezni_id,
            adresa,
            grad,
            drzava,
            rok_placanja_dana,
            napomena,
            aktivan,
            is_ino,
            pdv_oslobodjen,
            pdv_oslobodjen_napomena,
          ],
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, message });
      }
    }

    revalidatePath("/studio/klijenti");
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
