/**
 * Parsira XLSX buffer u niz objekata (prvi red = zaglavlje).
 * Ključevi se trimuju da se izbjegnu razmaci iz Excela.
 */
import * as XLSX from "xlsx";

export type RowRecord = Record<string, unknown>;

export function parseXlsxToRows(buffer: ArrayBuffer): RowRecord[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: "",
  });

  if (!raw.length) return [];

  // Normalizuj ključeve (trim) i prazne redove preskoči
  const rows: RowRecord[] = [];
  for (const row of raw) {
    const normalized: RowRecord = {};
    let isEmpty = true;
    for (const [key, value] of Object.entries(row)) {
      const k = String(key).trim();
      if (value !== undefined && value !== null && value !== "") isEmpty = false;
      normalized[k] = value;
    }
    if (!isEmpty) rows.push(normalized);
  }
  return rows;
}

/** Parsira XLSX sa više listova; vraća mapu ime_lista -> redovi. */
export function parseXlsxMultiSheet(buffer: ArrayBuffer): Record<string, RowRecord[]> {
  const wb = XLSX.read(buffer, { type: "array" });
  const out: Record<string, RowRecord[]> = {};
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: "",
    });
    const rows: RowRecord[] = [];
    for (const row of raw) {
      const normalized: RowRecord = {};
      let isEmpty = true;
      for (const [key, value] of Object.entries(row)) {
        const k = String(key).trim();
        if (value !== undefined && value !== null && value !== "") isEmpty = false;
        normalized[k] = value;
      }
      if (!isEmpty) rows.push(normalized);
    }
    out[sheetName] = rows;
  }
  return out;
}
