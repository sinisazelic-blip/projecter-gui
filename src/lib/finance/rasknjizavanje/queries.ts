import { query } from "@/lib/db";
import { findFakturaFromText } from "@/lib/bank/matchInvoiceFromText";
import {
  analyzeOwnerTransfer,
  buildOwnerHaystack,
  isFxConversionText,
} from "@/lib/finance/ownerTransfer";
import { analyzeBankFee } from "@/lib/finance/bankFeeDetect";
import { getOwnerEnv } from "@/lib/finance/ownerTransferApply";
import { deriveFakturaStatus, sumPlacenoByFaktura } from "./invoiceStatus";
import { isoDate, round2, type OpenInvoice, type QueuePosting } from "./types";

const queryConn = {
  execute: async (sql: string, params: unknown[] = []) => {
    const rows = await query(sql, params);
    return [rows];
  },
};

export async function getUnallocatedQueue(
  limit = 100,
  batchId?: number | null,
): Promise<QueuePosting[]> {
  const params: unknown[] = [];
  let batchSql = "";
  if (batchId != null && Number.isFinite(batchId) && batchId > 0) {
    batchSql = " AND p.batch_id = ?";
    params.push(batchId);
  }
  params.push(limit);

  const rows = await query(
    `SELECT
       p.posting_id,
       p.batch_id,
       p.value_date,
       p.amount,
       p.currency,
       p.counterparty,
       p.description,
       CASE
         WHEN COALESCE(s.linked_total_km, 0) < ABS(p.amount) - 0.001 THEN 'UNLINKED'
         WHEN COALESCE(s.linked_total_km, 0) > ABS(p.amount) + 0.001 THEN 'OVER_ALLOCATED'
         ELSE 'OK'
       END AS alloc_status,
       COALESCE(s.linked_total_km, 0) AS linked_total_km
     FROM bank_tx_posting p
     LEFT JOIN v_bank_posting_sanity s ON s.posting_id = p.posting_id
     WHERE (
       COALESCE(s.linked_total_km, 0) < ABS(p.amount) - 0.001
       OR COALESCE(s.linked_total_km, 0) > ABS(p.amount) + 0.001
     )${batchSql}
     ORDER BY p.value_date DESC, p.posting_id DESC
     LIMIT ?`,
    params,
  );

  return (rows || []).map((r: Record<string, unknown>) => {
    const amount = Number(r.amount);
    const linked = round2(Number(r.linked_total_km));
    const cap = round2(Math.abs(amount));
    return {
      posting_id: Number(r.posting_id),
      value_date: isoDate(r.value_date) || "",
      amount,
      currency: String(r.currency || "BAM"),
      counterparty: r.counterparty != null ? String(r.counterparty) : null,
      description: r.description != null ? String(r.description) : null,
      alloc_status: String(r.alloc_status || "UNLINKED"),
      linked_total_km: linked,
      remaining_km: round2(Math.max(0, cap - linked)),
      smjer: amount > 0 ? "IN" : "OUT",
    } satisfies QueuePosting;
  });
}

export async function getOpenInvoicesForClient(
  klijentId: number,
): Promise<OpenInvoice[]> {
  const rows = await query(
    `SELECT
       f.faktura_id,
       COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS faktura_broj,
       DATE(f.datum_izdavanja) AS datum_izdavanja,
       ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) AS iznos_km,
       COALESCE(NULLIF(TRIM(UPPER(f.valuta)), ''), 'BAM') AS valuta,
       TRIM(UPPER(COALESCE(f.fiskalni_status, ''))) AS fiskalni_status
     FROM fakture f
     WHERE f.bill_to_klijent_id = ?
       AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
     ORDER BY f.datum_izdavanja DESC, f.faktura_id DESC
     LIMIT 200`,
    [klijentId],
  );

  const out: OpenInvoice[] = [];
  for (const r of rows || []) {
    const fakturaId = Number(r.faktura_id);
    const iznos = round2(Number(r.iznos_km));
    const placeno = await sumPlacenoByFaktura(fakturaId);
    const preostalo = round2(Math.max(0, iznos - placeno));
    if (preostalo <= 0.01 && placeno >= iznos - 0.01) continue;
    out.push({
      faktura_id: fakturaId,
      faktura_broj: String(r.faktura_broj || ""),
      datum_izdavanja: isoDate(r.datum_izdavanja) || "",
      iznos_km: iznos,
      placeno_km: placeno,
      preostalo_km: preostalo,
      valuta: String(r.valuta || "BAM"),
      status_derived: deriveFakturaStatus(iznos, placeno),
    });
  }
  return out;
}

export async function suggestPostingContext(postingId: number) {
  const rows = await query(
    `SELECT p.posting_id, p.amount, p.value_date, p.counterparty, p.description, p.currency, p.batch_id,
            t.reference, t.description AS staging_description, t.full_description
     FROM bank_tx_posting p
     LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
     WHERE p.posting_id = ? LIMIT 1`,
    [postingId],
  );
  const p = rows?.[0];
  if (!p) return null;

  const haystack = [
    p.reference,
    p.staging_description,
    p.full_description,
    p.description,
    p.counterparty,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const amount = Number(p.amount);
  const cap = round2(Math.abs(amount));
  const sanity = await query(
    `SELECT linked_total_km, alloc_status FROM v_bank_posting_sanity WHERE posting_id = ?`,
    [postingId],
  );
  const linked = round2(Number(sanity?.[0]?.linked_total_km ?? 0));

  const { ownerPrivateAccountDigits } = getOwnerEnv();
  const ownerAnalysis = analyzeOwnerTransfer(haystack, amount, ownerPrivateAccountDigits);
  const fxConversion = isFxConversionText(haystack);
  const bankFee = analyzeBankFee(haystack, amount);

  let suggested_action:
    | "owner_transfer"
    | "owner_loan"
    | "fx_conversion"
    | "bank_provizija"
    | "invoice"
    | "expense"
    | null = null;
  if (bankFee) {
    suggested_action = "bank_provizija";
  } else if (ownerAnalysis.kind === "to_private_cash") {
    suggested_action = "owner_transfer";
  } else if (ownerAnalysis.kind === "owner_loan_in") {
    suggested_action = "owner_loan";
  } else if (fxConversion) {
    suggested_action = "fx_conversion";
  } else if (amount > 0) {
    suggested_action = "invoice";
  } else if (amount < 0) {
    suggested_action = "expense";
  }

  let klijent_id: number | null = null;
  let klijent_naziv: string | null = null;
  let suggested_faktura_id: number | null = null;

  const needsClientSuggest =
    suggested_action === "invoice" || suggested_action === null;

  if (needsClientSuggest) {
    const fakturaMatch = await findFakturaFromText(queryConn, haystack, null);
    suggested_faktura_id = fakturaMatch?.faktura_id ?? null;

    if (fakturaMatch?.faktura_id) {
      const inv = await query(
        `SELECT f.bill_to_klijent_id AS klijent_id, k.naziv_klijenta AS naziv
         FROM fakture f
         LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
         WHERE f.faktura_id = ? LIMIT 1`,
        [fakturaMatch.faktura_id],
      );
      klijent_id = inv?.[0]?.klijent_id != null ? Number(inv[0].klijent_id) : null;
      klijent_naziv = inv?.[0]?.naziv != null ? String(inv[0].naziv) : null;
    }

    if (!klijent_id && p.counterparty) {
      const cp = String(p.counterparty).trim();
      if (cp.length >= 3) {
        const kl = await query(
          `SELECT klijent_id, naziv_klijenta AS naziv FROM klijenti
           WHERE aktivan = 1 AND naziv_klijenta LIKE ?
           ORDER BY CHAR_LENGTH(naziv_klijenta) ASC LIMIT 5`,
          [`%${cp.slice(0, 24)}%`],
        );
        if (kl?.length === 1) {
          klijent_id = Number(kl[0].klijent_id);
          klijent_naziv = String(kl[0].naziv);
        }
      }
    }
  }

  let fx_pair_posting_id: number | null = null;
  if (fxConversion && p.batch_id) {
    const pairRows = await query(
      `SELECT p2.posting_id, p2.amount
       FROM bank_tx_posting p2
       LEFT JOIN bank_tx_staging t2 ON t2.tx_id = p2.tx_id
       LEFT JOIN v_bank_posting_sanity s2 ON s2.posting_id = p2.posting_id
       WHERE p2.batch_id = ?
         AND p2.posting_id <> ?
         AND COALESCE(s2.linked_total_km, 0) < ABS(p2.amount) - 0.001
         AND (
           LOWER(COALESCE(p2.description, '')) LIKE '%exch%konverzija%'
           OR LOWER(COALESCE(t2.description, '')) LIKE '%exch%konverzija%'
           OR LOWER(COALESCE(t2.full_description, '')) LIKE '%exch%konverzija%'
         )
       ORDER BY ABS(p2.posting_id - ?) ASC
       LIMIT 1`,
      [p.batch_id, postingId, postingId],
    );
    if (pairRows?.[0]?.posting_id) {
      const pairAmount = Number(pairRows[0].amount);
      if ((amount < 0 && pairAmount > 0) || (amount > 0 && pairAmount < 0)) {
        fx_pair_posting_id = Number(pairRows[0].posting_id);
      }
    }
  }

  const postingCurrency = String(p.currency || "BAM").trim().toUpperCase();

  return {
    posting_id: postingId,
    amount,
    smjer: amount > 0 ? "IN" : "OUT",
    value_date: isoDate(p.value_date),
    counterparty: p.counterparty != null ? String(p.counterparty) : null,
    description: p.description != null ? String(p.description) : null,
    currency: postingCurrency,
    haystack,
    suggested_action,
    suggested_faktura_id,
    suggested_klijent_id: klijent_id,
    suggested_klijent_naziv: klijent_naziv,
    remaining_km: round2(Math.max(0, cap - linked)),
    cap_km: cap,
    owner_transfer_reason: ownerAnalysis.kind === "to_private_cash" ? ownerAnalysis.reason : null,
    fx_conversion: fxConversion,
    fx_pair_posting_id,
    bank_fee_kind: bankFee?.kind ?? null,
    bank_fee_label: bankFee?.label ?? null,
  };
}

export async function searchClients(q: string) {
  const term = String(q || "").trim();
  if (term.length < 2) return [];
  return query(
    `SELECT klijent_id, naziv_klijenta AS naziv FROM klijenti
     WHERE aktivan = 1 AND naziv_klijenta LIKE ?
     ORDER BY naziv_klijenta ASC LIMIT 30`,
    [`%${term}%`],
  );
}

export async function searchPartners(
  partnerTip: "dobavljac" | "talent",
  q: string,
) {
  const term = String(q || "").trim();
  if (term.length < 2) return [];
  if (partnerTip === "talent") {
    return query(
      `SELECT talent_id AS partner_id, ime_prezime AS naziv FROM talenti
       WHERE ime_prezime LIKE ?
       ORDER BY ime_prezime ASC LIMIT 30`,
      [`%${term}%`],
    );
  }
  return query(
    `SELECT dobavljac_id AS partner_id, naziv FROM dobavljaci
     WHERE naziv LIKE ?
     ORDER BY naziv ASC LIMIT 30`,
    [`%${term}%`],
  );
}

export type OpenObaveza = {
  trosak_id: number;
  opis: string | null;
  projekat_naziv: string | null;
  datum: string;
  iznos_km: number;
  placeno_km: number;
  preostalo_km: number;
};

async function trosakDateExpr(alias = "t"): Promise<string> {
  const cols = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'projektni_troskovi'`,
  ).catch(() => []);
  const set = new Set((cols || []).map((c: { column_name: string }) => String(c.column_name)));
  const parts: string[] = [];
  if (set.has("datum_troska")) parts.push(`${alias}.datum_troska`);
  if (set.has("datum_nastanka")) parts.push(`${alias}.datum_nastanka`);
  parts.push(`${alias}.created_at`);
  return `COALESCE(${parts.join(", ")})`;
}

export async function getOpenObaveze(
  partnerTip: "dobavljac" | "talent",
  partnerId: number,
): Promise<OpenObaveza[]> {
  const isTalent = partnerTip === "talent";
  const dt = await trosakDateExpr("t");
  const rows = await query(
    `SELECT
       t.trosak_id,
       t.opis,
       DATE(${dt}) AS datum,
       ROUND(COALESCE(t.iznos_km, 0), 2) AS iznos_km,
       p.radni_naziv AS projekat_naziv
     FROM projektni_troskovi t
     LEFT JOIN projekti p ON p.projekat_id = t.projekat_id
     WHERE t.status <> 'STORNIRANO'
       AND (
         (${isTalent ? "t.entity_type = 'talent'" : "t.entity_type = 'vendor'"} AND t.entity_id = ?)
         OR (${isTalent ? "t.talent_id = ?" : "t.dobavljac_id = ?"})
       )
     ORDER BY datum ASC, t.trosak_id ASC
     LIMIT 200`,
    [partnerId, partnerId],
  );

  const out: OpenObaveza[] = [];
  for (const r of rows || []) {
    const trosakId = Number(r.trosak_id);
    const iznos = round2(Number(r.iznos_km));
    const placenoRows = await query(
      `SELECT ROUND(COALESCE(SUM(ps.iznos_km), 0), 2) AS s
       FROM placanja_stavke ps WHERE ps.trosak_id = ?`,
      [trosakId],
    );
    const placeno = round2(Number(placenoRows?.[0]?.s ?? 0));
    const preostalo = round2(Math.max(0, iznos - placeno));
    if (preostalo <= 0.01) continue;
    out.push({
      trosak_id: trosakId,
      opis: r.opis != null ? String(r.opis) : null,
      projekat_naziv: r.projekat_naziv != null ? String(r.projekat_naziv) : null,
      datum: isoDate(r.datum) || "",
      iznos_km: iznos,
      placeno_km: placeno,
      preostalo_km: preostalo,
    });
  }
  return out;
}
