/**
 * Naručilac na fakturi = Deal (inicijacija), ne projekat.
 * Projekat nosi kopiju iz trenutka konverzije; Deal je izvor istine za klijenta.
 * Fallback na projekti.narucilac_id samo ako deal nije vezan (legacy).
 */

/** JOIN inicijacije po projektu (jedan deal po projektu). */
export const SQL_DEAL_JOIN = `LEFT JOIN inicijacije i ON i.projekat_id = p.projekat_id`;

/** Efektivni naručilac za fakturisanje. */
export const SQL_BILL_TO_NARUCILAC_ID = `COALESCE(i.narucilac_id, p.narucilac_id)`;

/** Efektivni krajnji klijent (ako postoji na dealu). */
export const SQL_BILL_TO_KRAJNJI_KLIJENT_ID = `COALESCE(i.krajnji_klijent_id, p.krajnji_klijent_id)`;
