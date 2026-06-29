import type mysql from "mysql2/promise";
import {
  analyzeOwnerTransfer,
  buildOwnerHaystack,
  fxConversionMarker,
  isFxConversionText,
  normalizeDigits,
  ownerCashMarker,
} from "@/lib/finance/ownerTransfer";
import { RASKNJIŽAVANJE_VRSTA, isoDate, round2 } from "@/lib/finance/rasknjizavanje/types";

export function getOwnerEnv() {
  // Samo broj računa (KM→KM) je OK — normalizeDigits uklanja crtice/razmake.
  const ownerPrivateAccountRaw = process.env.FLUXA_OWNER_PRIVATE_ACCOUNT?.trim() || "";
  const ownerPrivateAccountDigits = normalizeDigits(ownerPrivateAccountRaw);
  const ownerProjectIdRaw = Number(process.env.FLUXA_OWNER_PROJECT_ID ?? 1);
  const ownerProjectId =
    Number.isFinite(ownerProjectIdRaw) && ownerProjectIdRaw > 0 ? ownerProjectIdRaw : 1;
  return { ownerPrivateAccountDigits, ownerProjectId };
}

async function insertRasknjizavanje(
  conn: mysql.PoolConnection,
  row: {
    posting_id: number;
    iznos_km: number;
    vrsta: string;
    napomena?: string | null;
    projekat_id?: number | null;
  },
) {
  await conn.execute(
    `INSERT INTO fin_rasknjizavanje
      (posting_id, iznos_km, vrsta, projekat_id, napomena, aktivan)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      row.posting_id,
      row.iznos_km,
      row.vrsta,
      row.projekat_id ?? null,
      row.napomena ?? null,
    ],
  );
}

/**
 * Prenos na privatni račun: blagajna IN + link postinga (bez projektni_prihodi / IOS).
 */
export async function applyOwnerTransferToBlagajna(
  conn: mysql.PoolConnection,
  row: {
    posting_id: number;
    amount: number;
    value_date: unknown;
    currency?: string | null;
    counterparty?: string | null;
    description?: string | null;
    staging_reference?: string | null;
    staging_description?: string | null;
    staging_full_description?: string | null;
  },
  ownerProjectId: number,
  ownerPrivateAccountDigits = "",
  force = false,
): Promise<{ applied: boolean; reason: string; blagajna_id?: number }> {
  const postingId = Number(row.posting_id);
  const amount = Number(row.amount);
  if (!Number.isFinite(postingId) || postingId <= 0) {
    return { applied: false, reason: "invalid_posting" };
  }

  const haystack = buildOwnerHaystack([
    row.counterparty,
    row.description,
    row.staging_reference,
    row.staging_description,
    row.staging_full_description,
  ]);

  const analysis = analyzeOwnerTransfer(haystack, amount, ownerPrivateAccountDigits);
  if (!force && analysis.kind !== "to_private_cash") {
    return { applied: false, reason: analysis.reason };
  }
  if (force && !(amount < 0)) {
    return { applied: false, reason: "must_be_outflow" };
  }

  const datum = isoDate(row.value_date);
  if (!datum) {
    return { applied: false, reason: "invalid_date" };
  }

  const amountKm = force ? round2(Math.abs(amount)) : analysis.amountAbs;
  const valuta = String(row.currency || "KM").trim().toUpperCase() || "KM";
  const marker = ownerCashMarker(postingId);

  const [cashExists]: any = await conn.execute(
    `SELECT id FROM blagajna_stavke WHERE transaction_details = ? LIMIT 1`,
    [marker],
  );
  let blagajnaId: number | undefined;
  if (!Array.isArray(cashExists) || cashExists.length === 0) {
    const [insCash]: any = await conn.execute(
      `INSERT INTO blagajna_stavke
        (datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id, transaction_details, status)
       VALUES (?, ?, ?, 'IN', ?, ?, NULL, NULL, ?, 'AKTIVAN')`,
      [
        datum,
        amountKm,
        valuta === "BAM" ? "KM" : valuta,
        "Prenos na privatni račun vlasnika (keš) — automatski iz izvoda.",
        ownerProjectId,
        marker,
      ],
    );
    blagajnaId = insCash?.insertId ?? undefined;
  } else {
    blagajnaId = cashExists[0]?.id;
  }

  const [linkExists]: any = await conn.execute(
    `SELECT link_id FROM bank_tx_posting_placanje_link
     WHERE posting_id = ? AND aktivan = 1 LIMIT 1`,
    [postingId],
  );
  if (!Array.isArray(linkExists) || linkExists.length === 0) {
    const [insPay]: any = await conn.execute(
      `INSERT INTO placanja
        (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
       VALUES (?, ?, ?, 1.000000, ?, 'PRENOS_VLASNIKA', ?, ?)`,
      [
        datum,
        amountKm,
        valuta === "BAM" ? "KM" : valuta,
        amountKm,
        `prenos_vlasnika:posting_id=${postingId}`,
        `Prenos vlasnika na privatni račun [posting ${postingId}]`,
      ],
    );
    const placanjeId = insPay?.insertId ?? null;
    if (placanjeId) {
      await conn.execute(
        `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
         VALUES (?, ?, ?, 1)`,
        [postingId, placanjeId, amountKm],
      );
    }
  }

  const [raskExists]: any = await conn.execute(
    `SELECT rasknjizavanje_id FROM fin_rasknjizavanje
     WHERE posting_id = ? AND vrsta = ? AND aktivan = 1 LIMIT 1`,
    [postingId, RASKNJIŽAVANJE_VRSTA.PRENOS_VLASNIKA],
  );
  if (!Array.isArray(raskExists) || raskExists.length === 0) {
    await insertRasknjizavanje(conn, {
      posting_id: postingId,
      iznos_km: amountKm,
      vrsta: RASKNJIŽAVANJE_VRSTA.PRENOS_VLASNIKA,
      projekat_id: ownerProjectId,
      napomena: "Prenos na privatni račun → blagajna IN",
    });
  }

  await conn.execute(`UPDATE bank_tx_posting SET kategorija = 'prenos_vlasnika' WHERE posting_id = ?`, [
    postingId,
  ]);

  return { applied: true, reason: force ? "manual" : analysis.reason, blagajna_id: blagajnaId };
}

/**
 * Posudba vlasnika (privatni → poslovni račun): neutralno knjiženje, bez IOS prihoda i bez blagajne.
 */
export async function applyOwnerLoanFromPrivate(
  conn: mysql.PoolConnection,
  row: {
    posting_id: number;
    amount: number;
    value_date: unknown;
    counterparty?: string | null;
    description?: string | null;
    staging_reference?: string | null;
    staging_description?: string | null;
    staging_full_description?: string | null;
  },
  ownerProjectId: number,
  ownerPrivateAccountDigits = "",
  force = false,
): Promise<{ applied: boolean; reason: string }> {
  const postingId = Number(row.posting_id);
  const amount = Number(row.amount);
  if (!Number.isFinite(postingId) || postingId <= 0) {
    return { applied: false, reason: "invalid_posting" };
  }

  const haystack = buildOwnerHaystack([
    row.counterparty,
    row.description,
    row.staging_reference,
    row.staging_description,
    row.staging_full_description,
  ]);

  const analysis = analyzeOwnerTransfer(haystack, amount, ownerPrivateAccountDigits);
  if (!force && analysis.kind !== "owner_loan_in") {
    return { applied: false, reason: analysis.reason };
  }
  if (force && !(amount > 0)) {
    return { applied: false, reason: "must_be_inflow" };
  }

  const datum = isoDate(row.value_date);
  if (!datum) {
    return { applied: false, reason: "invalid_date" };
  }

  const amountKm = force ? round2(amount) : analysis.amountAbs;

  const [linkPrihod]: any = await conn.execute(
    `SELECT link_id FROM bank_tx_posting_prihod_link WHERE posting_id = ? AND aktivan = 1 LIMIT 1`,
    [postingId],
  );
  const [linkPlac]: any = await conn.execute(
    `SELECT link_id FROM bank_tx_posting_placanje_link WHERE posting_id = ? AND aktivan = 1 LIMIT 1`,
    [postingId],
  );
  if (
    (Array.isArray(linkPrihod) && linkPrihod.length > 0) ||
    (Array.isArray(linkPlac) && linkPlac.length > 0)
  ) {
    return { applied: false, reason: "already_linked" };
  }

  const [insPrihod]: any = await conn.execute(
    `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis)
     VALUES (?, ?, 0, ?)`,
    [ownerProjectId, datum, `Posudba vlasnika (neutralno) [posting ${postingId}]`],
  );
  const prihodId = insPrihod?.insertId ?? null;
  if (!prihodId) return { applied: false, reason: "prihod_failed" };

  await conn.execute(
    `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at)
     VALUES (?, ?, ?, 1, NOW())`,
    [postingId, prihodId, amountKm],
  );

  const [raskExists]: any = await conn.execute(
    `SELECT rasknjizavanje_id FROM fin_rasknjizavanje
     WHERE posting_id = ? AND vrsta = ? AND aktivan = 1 LIMIT 1`,
    [postingId, RASKNJIŽAVANJE_VRSTA.POSUDBA_VLASNIKA],
  );
  if (!Array.isArray(raskExists) || raskExists.length === 0) {
    await insertRasknjizavanje(conn, {
      posting_id: postingId,
      iznos_km: amountKm,
      vrsta: RASKNJIŽAVANJE_VRSTA.POSUDBA_VLASNIKA,
      projekat_id: ownerProjectId,
      napomena: "Posudba vlasnika → poslovni račun (neutralno)",
    });
  }

  await conn.execute(`UPDATE bank_tx_posting SET kategorija = 'posudba_vlasnika' WHERE posting_id = ?`, [
    postingId,
  ]);

  return { applied: true, reason: force ? "manual" : analysis.reason };
}

/**
 * EXCH konverzija: neutralno knjiženje (isti novac, druga valuta). Ne utiče na IOS prihoda.
 */
export async function applyFxConversionNeutral(
  conn: mysql.PoolConnection,
  row: {
    posting_id: number;
    amount: number;
    value_date: unknown;
    description?: string | null;
    counterparty?: string | null;
    staging_description?: string | null;
    staging_full_description?: string | null;
  },
  ownerProjectId: number,
  force = false,
): Promise<{ applied: boolean; reason: string }> {
  const postingId = Number(row.posting_id);
  const amount = Number(row.amount);
  if (!Number.isFinite(postingId) || postingId <= 0 || amount === 0) {
    return { applied: false, reason: "invalid" };
  }

  const datum = isoDate(row.value_date);
  if (!datum) {
    return { applied: false, reason: "invalid_date" };
  }

  const haystack = buildOwnerHaystack([
    row.description,
    row.counterparty,
    row.staging_description,
    row.staging_full_description,
  ]);
  if (!force && !isFxConversionText(haystack)) {
    return { applied: false, reason: "not_fx" };
  }

  const amountAbs = round2(Math.abs(amount));

  const [linkPrihod]: any = await conn.execute(
    `SELECT link_id FROM bank_tx_posting_prihod_link WHERE posting_id = ? AND aktivan = 1 LIMIT 1`,
    [postingId],
  );
  const [linkPlac]: any = await conn.execute(
    `SELECT link_id FROM bank_tx_posting_placanje_link WHERE posting_id = ? AND aktivan = 1 LIMIT 1`,
    [postingId],
  );
  if (
    (Array.isArray(linkPrihod) && linkPrihod.length > 0) ||
    (Array.isArray(linkPlac) && linkPlac.length > 0)
  ) {
    return { applied: false, reason: "already_linked" };
  }

  if (amount > 0) {
    const [insPrihod]: any = await conn.execute(
      `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis)
       VALUES (?, ?, 0, ?)`,
      [ownerProjectId, datum, `Konverzija valute (neutralno) [posting ${postingId}]`],
    );
    const prihodId = insPrihod?.insertId ?? null;
    if (!prihodId) return { applied: false, reason: "prihod_failed" };
    await conn.execute(
      `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at)
       VALUES (?, ?, ?, 1, NOW())`,
      [postingId, prihodId, amountAbs],
    );
  } else {
    const [insPay]: any = await conn.execute(
      `INSERT INTO placanja
        (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
       VALUES (?, ?, 'BAM', 1.000000, 0, 'BANK_KONVERZIJA', ?, ?)`,
      [
        datum,
        amountAbs,
        fxConversionMarker(postingId),
        `Konverzija valute (neutralno) [posting ${postingId}]`,
      ],
    );
    const placanjeId = insPay?.insertId ?? null;
    if (!placanjeId) return { applied: false, reason: "placanje_failed" };
    await conn.execute(
      `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
       VALUES (?, ?, ?, 1)`,
      [postingId, placanjeId, amountAbs],
    );
  }

  await insertRasknjizavanje(conn, {
    posting_id: postingId,
    iznos_km: amountAbs,
    vrsta: RASKNJIŽAVANJE_VRSTA.KONVERZIJA,
    projekat_id: ownerProjectId,
    napomena: amount > 0 ? "EXCH priliv KM (neutralno)" : "EXCH odliv EUR (neutralno)",
  });

  await conn.execute(`UPDATE bank_tx_posting SET kategorija = 'konverzija' WHERE posting_id = ?`, [
    postingId,
  ]);

  return { applied: true, reason: amount > 0 ? "fx_in_km" : "fx_out_eur" };
}
