/**
 * Iz teksta uplatnice (description / reference) izvlači referencu na fakturu:
 * - RNBR0242026 / UPLATA PO RNBR0242026
 * - broj fakture NNN/GGGG
 * - 8-cifreni poziv na broj
 */

export type InvoiceRef =
  | { type: "poziv"; value: string }
  | { type: "broj"; broj: number; godina: number }
  | null;

/** RNBR0242026, RN:BR 024/2026, UPLATA PO RNBR0242026 */
export function parseRnbrBrojGodina(text: string): { broj: number; godina: number } | null {
  const s = String(text ?? "");
  if (!s.trim()) return null;

  const slash = s.match(/\bRN\s*:?\s*BR\s*0*(\d{1,4})\s*\/\s*(\d{4})\b/i);
  if (slash) {
    const broj = parseInt(slash[1], 10);
    const godina = parseInt(slash[2], 10);
    if (Number.isFinite(broj) && Number.isFinite(godina) && godina >= 2000 && godina <= 2100) {
      return { broj, godina };
    }
  }

  const compact = s.match(/\bRN\s*:?\s*BR\s*0*(\d{1,4})(\d{4})\b/i);
  if (compact) {
    const broj = parseInt(compact[1], 10);
    const godina = parseInt(compact[2], 10);
    if (Number.isFinite(broj) && Number.isFinite(godina) && godina >= 2000 && godina <= 2100) {
      return { broj, godina };
    }
  }

  return null;
}

/**
 * Iz jednog teksta vraća prvu pronađenu referencu.
 */
export function extractInvoiceRef(text: string | null | undefined): InvoiceRef {
  const s = String(text ?? "").trim();
  if (!s) return null;

  const rnbr = parseRnbrBrojGodina(s);
  if (rnbr) return { type: "broj", broj: rnbr.broj, godina: rnbr.godina };

  const brojMatch = s.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (brojMatch) {
    const broj = parseInt(brojMatch[1], 10);
    const godina = parseInt(brojMatch[2], 10);
    if (Number.isFinite(broj) && Number.isFinite(godina) && godina >= 2000 && godina <= 2100)
      return { type: "broj", broj, godina };
  }

  const pozivMatch = s.match(/\b(\d{8})\b/);
  if (pozivMatch) return { type: "poziv", value: pozivMatch[1] };

  return null;
}

/**
 * Vraća faktura_id ako postoji neplaćena faktura s tim poziv_na_broj.
 */
export async function findFakturaByPoziv(
  conn: any,
  poziv8: string
): Promise<{ faktura_id: number; projekat_id: number } | null> {
  const [rows]: any = await conn.execute(
    `SELECT f.faktura_id, 
            (SELECT fp.projekat_id FROM faktura_projekti fp WHERE fp.faktura_id = f.faktura_id ORDER BY fp.projekat_id ASC LIMIT 1) AS projekat_id
     FROM fakture f
     WHERE f.poziv_na_broj = ? 
       AND (f.fiskalni_status IS NULL OR TRIM(UPPER(f.fiskalni_status)) NOT IN ('PLACENA','DJELIMICNO','PAID','PLACENO','STORNIRAN','ZAMIJENJEN'))
     LIMIT 1`,
    [poziv8]
  );
  const r = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!r?.faktura_id) return null;
  return {
    faktura_id: Number(r.faktura_id),
    projekat_id: r.projekat_id != null ? Number(r.projekat_id) : 0,
  };
}

/**
 * Vraća faktura_id ako postoji neplaćena faktura s tim broj_u_godini i godina.
 */
export async function findFakturaByBrojGodina(
  conn: any,
  broj: number,
  godina: number
): Promise<{ faktura_id: number; projekat_id: number } | null> {
  const [rows]: any = await conn.execute(
    `SELECT f.faktura_id,
            (SELECT fp.projekat_id FROM faktura_projekti fp WHERE fp.faktura_id = f.faktura_id ORDER BY fp.projekat_id ASC LIMIT 1) AS projekat_id
     FROM fakture f
     WHERE f.broj_u_godini = ? AND f.godina = ?
       AND (f.fiskalni_status IS NULL OR TRIM(UPPER(f.fiskalni_status)) NOT IN ('PLACENA','DJELIMICNO','PAID','PLACENO','STORNIRAN','ZAMIJENJEN'))
     LIMIT 1`,
    [broj, godina]
  );
  const r = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!r?.faktura_id) return null;
  return {
    faktura_id: Number(r.faktura_id),
    projekat_id: r.projekat_id != null ? Number(r.projekat_id) : 0,
  };
}

/**
 * Za dani tekst (description + optional reference) nađi fakturu i vrati { faktura_id, projekat_id } ili null.
 */
export async function findFakturaFromText(
  conn: any,
  description: string | null,
  reference?: string | null
): Promise<{ faktura_id: number; projekat_id: number } | null> {
  const haystack = [description, reference]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!haystack) return null;

  const rnbr = parseRnbrBrojGodina(haystack);
  if (rnbr) {
    const found = await findFakturaByBrojGodina(conn, rnbr.broj, rnbr.godina);
    if (found) return found;
  }

  const brojMatch = haystack.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (brojMatch) {
    const broj = parseInt(brojMatch[1], 10);
    const godina = parseInt(brojMatch[2], 10);
    if (Number.isFinite(broj) && Number.isFinite(godina) && godina >= 2000 && godina <= 2100) {
      const found = await findFakturaByBrojGodina(conn, broj, godina);
      if (found) return found;
    }
  }

  try {
    const pozivMatch = haystack.match(/\b(\d{8})\b/);
    if (pozivMatch) {
      const found = await findFakturaByPoziv(conn, pozivMatch[1]);
      if (found) return found;
    }
  } catch {
    // poziv_na_broj kolona ili šema
  }

  return null;
}
