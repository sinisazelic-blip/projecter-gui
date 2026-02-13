/**
 * Export podataka u Excel (.xlsx) – za izvještaje koje koriste knjigovođe.
 * Koristi biblioteku xlsx (SheetJS).
 */
import * as XLSX from "xlsx";

/**
 * Preuzima tabelu (zaglavlje + redovi) kao Excel fajl.
 * @param {Object} opts
 * @param {string} opts.filename - Ime fajla bez ekstenzije (npr. "potrazivanja_2025-01-01_2025-12-31")
 * @param {string} opts.sheetName - Ime lista u Excelu (npr. "Potraživanja")
 * @param {string[]} opts.headers - Nazivi kolona
 * @param {any[][]} opts.rows - Redovi podataka (niz nizova, redom kao headers)
 * @param {any[][]} [opts.footerRows] - Opcioni redovi ispod podataka (npr. prazan red + ukupno)
 */
export function downloadExcel({ filename, sheetName, headers, rows, footerRows = [] }) {
  const aoa = [headers, ...rows, ...footerRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Izvještaj");
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, name);
}

/**
 * Generiše naziv fajla za izvještaj: prefix_datumOd_datumDo.xlsx
 * Ako nema datuma, koristi "svi-podaci".
 */
export function reportFilename(prefix, dateFrom, dateTo) {
  const from = dateFrom || "svi";
  const to = dateTo || "podaci";
  return `${prefix}_${from}_${to}`;
}
