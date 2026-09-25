"use client";

import { downloadExcel } from "@/lib/exportExcel";

/**
 * Dugme za preuzimanje trenutne tabele u Excel (.xlsx).
 * Korisno za knjigovođe i arhivu.
 * @param {Object} props
 * @param {string} [props.filename] - Ime fajla (bez .xlsx)
 * @param {string} [props.sheetName] - Ime lista u Excelu
 * @param {string[]} [props.headers] - Nazivi kolona
 * @param {any[][]} [props.rows] - Redovi podataka (niz nizova)
 * @param {any[][]} [props.footerRows] - Opcioni redovi ispod (npr. ukupno)
 * @param {boolean} [props.disabled] - Sakrij ili onemogući ako nema podataka
 * @param {string} [props.className]
 * @param {React.CSSProperties} [props.style]
 */
export function ExportExcelButton({
  filename,
  sheetName = "Lista",
  headers = [],
  rows = [],
  footerRows = [],
  disabled,
  className = "",
  style = {},
}) {
  const hasData = Array.isArray(headers) && headers.length > 0 && Array.isArray(rows);
  const effectiveDisabled = disabled || !hasData;

  const handleClick = () => {
    if (effectiveDisabled) return;
    downloadExcel({
      filename: filename || "export",
      sheetName: sheetName || "Lista",
      headers,
      rows,
      footerRows,
    });
  };

  if (effectiveDisabled && !hasData) return null;

  return (
    <button
      type="button"
      className={className || "btn"}
      onClick={handleClick}
      disabled={effectiveDisabled}
      title="Preuzmi tabelu u Excel (.xlsx)"
      style={style}
    >
      Export u Excel
    </button>
  );
}
