export const RASKNJIŽAVANJE_VRSTA = {
  NAPLATA_FAKTURE: "NAPLATA_FAKTURE",
  OTPIS_TOLERANCIJE: "OTPIS_TOLERANCIJE",
  BANK_PROVIZIJA: "BANK_PROVIZIJA",
  ISPLATA_TROSKA: "ISPLATA_TROSKA",
  KREDIT_KLIJENTA: "KREDIT_KLIJENTA",
  POCETNO_STANJE: "POCETNO_STANJE",
  KONVERZIJA: "KONVERZIJA",
  PRENOS_VLASNIKA: "PRENOS_VLASNIKA",
  POSUDBA_VLASNIKA: "POSUDBA_VLASNIKA",
  OSTALO: "OSTALO",
} as const;

export type RasknjizavanjeVrsta =
  (typeof RASKNJIŽAVANJE_VRSTA)[keyof typeof RASKNJIŽAVANJE_VRSTA];

export type QueuePosting = {
  posting_id: number;
  value_date: string;
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  alloc_status: string;
  linked_total_km: number;
  remaining_km: number;
  smjer: "IN" | "OUT";
};

export type OpenInvoice = {
  faktura_id: number;
  faktura_broj: string;
  datum_izdavanja: string;
  iznos_km: number;
  placeno_km: number;
  preostalo_km: number;
  valuta: string;
  status_derived: string;
};

export type AllocationLine = {
  vrsta: RasknjizavanjeVrsta;
  iznos_km: number;
  faktura_id?: number;
  trosak_id?: number;
  klijent_id?: number;
  talent_id?: number;
  dobavljac_id?: number;
  projekat_id?: number;
  napomena?: string;
};

export type CommitPayload = {
  posting_id: number;
  lines: AllocationLine[];
  tolerancija?: {
    faktura_id: number;
    iznos_km: number;
    napomena?: string;
  } | null;
};

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function isoDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}
