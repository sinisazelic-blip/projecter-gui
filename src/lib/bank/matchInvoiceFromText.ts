/**
 * Iz teksta uplatnice (description / reference) izvlači referencu na fakturu:
 * - 8-cifreni poziv na broj
 * - broj fakture u formatu NNN/GGGG ili N/GGGG (npr. 001/2026, 1/2026, fakturi 001/2026)
 */

export type InvoiceRef =
  | { type: "poziv"; value: string }
  | { type: "broj"; broj: number; godina: number }
  | null;

const POZIV_8 = /\b(\d{8})\b/g;
const BROJ_FAKTURE = /\b(\d{1,4})\s*\/\s*(\d{4})\b/g;

/**
 * Iz jednog teksta vraća prvu pronađenu referencu: prvo 8-cifreni poziv, pa broj/godina.
 */
export function extractInvoiceRef(text: string | null | undefined): InvoiceRef {
  const s = String(text ?? "").trim();
  if (!s) return null;

  const pozivMatch = s.match(/\b(\d{8})\b/);
  if (pozivMatch) return { type: "poziv", value: pozivMatch[1] };

  const brojMatch = s.match(/\b(\d{1,4})\s*\/\s*(\d{4})\b/);
  if (brojMatch) {
    const broj = parseInt(brojMatch[1], 10);
    const godina = parseInt(brojMatch[2], 10);
    if (Number.isFinite(broj) && Number.isFinite(godina) && godina >= 2000 && godina <= 2100)
      return { type: "broj", broj, godina };
  }

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
       AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA','STORNIRAN','ZAMIJENJEN'))
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
       AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA','STORNIRAN','ZAMIJENJEN'))
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
  const ref = extractInvoiceRef(description || reference || "");
  if (!ref) return null;

  if (ref.type === "poziv") {
    try {
      const found = await findFakturaByPoziv(conn, ref.value);
      if (found) return found;
    } catch {
      // Kolona poziv_na_broj možda ne postoji u fakture
    }
  }

  if (ref.type === "broj") {
    const found = await findFakturaByBrojGodina(conn, ref.broj, ref.godina);
    if (found) return found;
  }

  return null;
}
