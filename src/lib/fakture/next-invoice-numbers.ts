import { query } from "@/lib/db";

export type NextInvoiceNumbers = {
  godina: number;
  next_broj_u_godini: number;
  next_broj_fakture: string;
  next_pfr: number;
  pfr_source: "manual" | "db_max";
};

/**
 * Ista logika kao pri POST /api/fakture/create — samo pregled, bez upisa.
 */
export async function computeNextInvoiceNumbers(
  godina: number,
  pfrLastManual?: number | null,
): Promise<NextInvoiceNumbers> {
  const y = Math.trunc(godina);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new Error("Neispravna godina");
  }

  let maxIzFakture = 0;
  try {
    const rows = await query(
      `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?`,
      [y],
    );
    maxIzFakture = Number((rows as { m?: number }[])?.[0]?.m ?? 0) || 0;
  } catch {
    maxIzFakture = 0;
  }

  let brojacZadnji = 0;
  try {
    const rows = await query(
      `SELECT zadnji_broj_u_godini FROM brojac_faktura WHERE godina = ? LIMIT 1`,
      [y],
    );
    brojacZadnji = Number((rows as { zadnji_broj_u_godini?: number }[])?.[0]?.zadnji_broj_u_godini ?? 0) || 0;
  } catch {
    brojacZadnji = 0;
  }

  const sledeciBroj = Math.max(maxIzFakture, brojacZadnji) + 1;

  let nextPfr: number;
  let pfrSource: "manual" | "db_max";
  const manual =
    pfrLastManual != null && Number.isFinite(pfrLastManual) && pfrLastManual >= 0
      ? Math.trunc(pfrLastManual)
      : null;

  if (manual != null) {
    nextPfr = manual + 1;
    pfrSource = "manual";
  } else {
    let maxPfr = 0;
    try {
      const rows = await query(
        `SELECT COALESCE(MAX(broj_fiskalni), 0) AS max_pfr
         FROM fakture
         WHERE broj_fiskalni IS NOT NULL AND broj_fiskalni > 0`,
      );
      maxPfr = Number((rows as { max_pfr?: number }[])?.[0]?.max_pfr ?? 0) || 0;
    } catch {
      maxPfr = 0;
    }
    nextPfr = maxPfr + 1;
    pfrSource = "db_max";
  }

  return {
    godina: y,
    next_broj_u_godini: sledeciBroj,
    next_broj_fakture: `${String(sledeciBroj).padStart(3, "0")}/${y}`,
    next_pfr: nextPfr,
    pfr_source: pfrSource,
  };
}
