import { query } from "@/lib/db";
import { round2 } from "./types";

const PAID_STATUSES = new Set([
  "PLACENA",
  "PAID",
  "PLACENO",
  "STORNIRAN",
  "ZAMIJENJEN",
]);

export async function sumPlacenoByFaktura(fakturaId: number): Promise<number> {
  const rows = await query<{ s: number }>(
    `SELECT ROUND(COALESCE(SUM(COALESCE(pr.iznos_km, 0)), 0), 2) AS s
     FROM projektni_prihodi pr
     WHERE pr.faktura_id = ?`,
    [fakturaId],
  );
  return round2(rows?.[0]?.s ?? 0);
}

export async function getFakturaTotal(fakturaId: number): Promise<number> {
  const rows = await query<{ total: number }>(
    `SELECT ROUND(COALESCE(f.iznos_ukupno_km, 0), 2) AS total
     FROM fakture f WHERE f.faktura_id = ? LIMIT 1`,
    [fakturaId],
  );
  return round2(rows?.[0]?.total ?? 0);
}

export function deriveFakturaStatus(
  totalKm: number,
  placenoKm: number,
): "DODIJELJEN" | "DJELIMICNO" | "PLACENA" | "PREPLACENA" {
  const total = round2(totalKm);
  const paid = round2(placenoKm);
  if (paid <= 0.01) return "DODIJELJEN";
  if (paid + 0.01 < total) return "DJELIMICNO";
  if (paid <= total + 0.01) return "PLACENA";
  return "PREPLACENA";
}

export async function syncFakturaPaymentStatus(fakturaId: number): Promise<string> {
  const [total, paid] = await Promise.all([
    getFakturaTotal(fakturaId),
    sumPlacenoByFaktura(fakturaId),
  ]);
  const status = deriveFakturaStatus(total, paid);
  const dbStatus = status === "PREPLACENA" ? "PLACENA" : status;
  await query(`UPDATE fakture SET fiskalni_status = ? WHERE faktura_id = ?`, [
    dbStatus,
    fakturaId,
  ]).catch(() => null);
  return status;
}

export async function sumPlacenoTrosak(trosakId: number): Promise<number> {
  const rows = await query<{ s: number }>(
    `SELECT ROUND(COALESCE(SUM(COALESCE(ps.iznos_km, 0)), 0), 2) AS s
     FROM placanja_stavke ps WHERE ps.trosak_id = ?`,
    [trosakId],
  );
  return round2(rows?.[0]?.s ?? 0);
}

export async function getPartnerTolerancijaMax(
  partnerTip: "klijent",
  partnerId: number,
): Promise<number> {
  const rows = await query<{ max_iznos_km: number }>(
    `SELECT max_iznos_km FROM fin_partner_tolerancija
     WHERE partner_tip = ? AND partner_id = ? AND aktivan = 1 LIMIT 1`,
    [partnerTip, partnerId],
  ).catch(() => []);
  if (rows?.[0]?.max_iznos_km != null) return round2(Number(rows[0].max_iznos_km));

  const legacy = await query<{ napomena: string }>(
    `SELECT COALESCE(napomena, '') AS napomena FROM klijenti WHERE klijent_id = ? LIMIT 1`,
    [partnerId],
  ).catch(() => []);
  if (String(legacy?.[0]?.napomena || "").includes("[AUTO_BANK_OTPIS]")) {
    return round2(Number(process.env.BANK_WRITE_OFF_MAX_PER_INVOICE || 25));
  }
  return 0;
}

export { PAID_STATUSES };
