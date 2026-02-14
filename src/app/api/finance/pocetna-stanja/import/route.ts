import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseXlsxMultiSheet } from "@/lib/import-xlsx";
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

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
    const sheets = parseXlsxMultiSheet(buf);

    const errors: { sheet: string; row: number; message: string }[] = [];
    let importedKlijenti = 0;
    let importedDobavljaci = 0;
    let importedTalenti = 0;

    // Mapiranje naziv -> id iz šifarnika
    const klijentMap = new Map<string, number>();
    const dobavljacMap = new Map<string, number>();
    const talentMap = new Map<string, number>();

    try {
      const klijentiRows = (await query(
        "SELECT klijent_id, naziv_klijenta FROM klijenti",
        [],
      )) as { klijent_id: number; naziv_klijenta: string }[];
      for (const k of klijentiRows || []) {
        const n = String(k.naziv_klijenta ?? "").trim();
        if (n) klijentMap.set(n.toLowerCase(), Number(k.klijent_id));
      }
    } catch {
      // tabela prazna ili ne postoji
    }
    try {
      const dobavljaciRows = (await query(
        "SELECT dobavljac_id, naziv FROM dobavljaci",
        [],
      )) as { dobavljac_id: number; naziv: string }[];
      for (const d of dobavljaciRows || []) {
        const n = String(d.naziv ?? "").trim();
        if (n) dobavljacMap.set(n.toLowerCase(), Number(d.dobavljac_id));
      }
    } catch {
      //
    }
    try {
      const talentiRows = (await query(
        "SELECT talent_id, ime_prezime FROM talenti",
        [],
      )) as { talent_id: number; ime_prezime: string }[];
      for (const t of talentiRows || []) {
        const n = String(t.ime_prezime ?? "").trim();
        if (n) talentMap.set(n.toLowerCase(), Number(t.talent_id));
      }
    } catch {
      //
    }

    // List "Klijenti" – kolone: naziv_klijenta, iznos_potrazuje, napomena
    const klijentiSheet =
      sheets["Klijenti"] ?? sheets["klijenti"] ?? [];
    for (let i = 0; i < klijentiSheet.length; i++) {
      const r = klijentiSheet[i];
      const rowNum = i + 2;
      const naziv = str(r, "naziv_klijenta");
      if (!naziv) continue;
      const klijentId = klijentMap.get(naziv.toLowerCase());
      if (klijentId == null) {
        errors.push({
          sheet: "Klijenti",
          row: rowNum,
          message: `Klijent "${naziv}" nije u šifarniku.`,
        });
        continue;
      }
      const iznos = num(r.iznos_potrazuje);
      const napomena = cleanStr(r.napomena);
      try {
        await query(
          `INSERT INTO klijent_pocetno_stanje (klijent_id, iznos_potrazuje, napomena)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE iznos_potrazuje = VALUES(iznos_potrazuje), napomena = VALUES(napomena)`,
          [klijentId, iznos, napomena],
        );
        importedKlijenti++;
      } catch (err) {
        errors.push({
          sheet: "Klijenti",
          row: rowNum,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // List "Dobavljači" – kolone: naziv, iznos_duga, napomena
    const dobavljaciSheet =
      sheets["Dobavljači"] ?? sheets["Dobavljaci"] ?? sheets["dobavljaci"] ?? [];
    for (let i = 0; i < dobavljaciSheet.length; i++) {
      const r = dobavljaciSheet[i];
      const rowNum = i + 2;
      const naziv = str(r, "naziv");
      if (!naziv) continue;
      const dobavljacId = dobavljacMap.get(naziv.toLowerCase());
      if (dobavljacId == null) {
        errors.push({
          sheet: "Dobavljači",
          row: rowNum,
          message: `Dobavljač "${naziv}" nije u šifarniku.`,
        });
        continue;
      }
      const iznos = num(r.iznos_duga);
      const napomena = cleanStr(r.napomena);
      try {
        await query(
          `INSERT INTO dobavljac_pocetno_stanje (dobavljac_id, iznos_duga, napomena)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE iznos_duga = VALUES(iznos_duga), napomena = VALUES(napomena)`,
          [dobavljacId, iznos, napomena],
        );
        importedDobavljaci++;
      } catch (err) {
        errors.push({
          sheet: "Dobavljači",
          row: rowNum,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // List "Talenti" – kolone: ime_prezime, iznos_duga, napomena
    const talentiSheet =
      sheets["Talenti"] ?? sheets["talenti"] ?? [];
    for (let i = 0; i < talentiSheet.length; i++) {
      const r = talentiSheet[i];
      const rowNum = i + 2;
      const naziv = str(r, "ime_prezime");
      if (!naziv) continue;
      const talentId = talentMap.get(naziv.toLowerCase());
      if (talentId == null) {
        errors.push({
          sheet: "Talenti",
          row: rowNum,
          message: `Talent "${naziv}" nije u šifarniku.`,
        });
        continue;
      }
      const iznos = num(r.iznos_duga);
      const napomena = cleanStr(r.napomena);
      try {
        await query(
          `INSERT INTO talent_pocetno_stanje (talent_id, iznos_duga, napomena)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE iznos_duga = VALUES(iznos_duga), napomena = VALUES(napomena)`,
          [talentId, iznos, napomena],
        );
        importedTalenti++;
      } catch (err) {
        errors.push({
          sheet: "Talenti",
          row: rowNum,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const total = importedKlijenti + importedDobavljaci + importedTalenti;
    revalidatePath("/finance/pocetna-stanja");
    return NextResponse.json({
      ok: true,
      imported: total,
      importedKlijenti,
      importedDobavljaci,
      importedTalenti,
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
