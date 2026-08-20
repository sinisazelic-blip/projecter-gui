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
  /** Isplata PDV-a (UIO itd.) */
  PDV: "PDV",
  /** Paušal / ostali porez */
  POREZ: "POREZ",
  /** Rata kredita / zajma */
  KREDIT: "KREDIT",
  /** Održavanje fiskalnih kasa / slične usluge */
  FISKALNE: "FISKALNE",
  /** Pozitivna kamata na računu (IN) */
  KAMATA: "KAMATA",
  /** Posting već pokriven drugim knjiženjem (npr. blagajna) */
  VEC_KNJIZENO: "VEC_KNJIZENO",
  /** Isplata dobavljaču bez prethodno otvorene obaveze */
  DIREKTAN_TROSAK: "DIREKTAN_TROSAK",
  OSTALO: "OSTALO",
} as const;

/** Specijalne isplate/uplate koje samo zatvaraju posting (+ opcionalno prihod/partner). */
export const SPECIAL_PAYMENT_CFG: Record<
  string,
  { label: string; kategorija: string; nacin: string; allowIn?: boolean; allowOut?: boolean }
> = {
  [RASKNJIŽAVANJE_VRSTA.BANK_PROVIZIJA]: {
    label: "Bankovna naknada",
    kategorija: "provizija",
    nacin: "BANK_PROVIZIJA",
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.PDV]: {
    label: "PDV",
    kategorija: "pdv",
    nacin: "BANK_PDV",
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.POREZ]: {
    label: "Porez",
    kategorija: "porez",
    nacin: "BANK_POREZ",
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.KREDIT]: {
    label: "Kredit",
    kategorija: "kredit",
    nacin: "BANK_KREDIT",
    allowOut: true,
    allowIn: true,
  },
  [RASKNJIŽAVANJE_VRSTA.FISKALNE]: {
    label: "Fiskalne kase",
    kategorija: "fiskalne_kase",
    nacin: "BANK_FISKALNE",
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.KAMATA]: {
    label: "Kamata",
    kategorija: "kamata",
    nacin: "BANK_KAMATA",
    allowIn: true,
  },
  [RASKNJIŽAVANJE_VRSTA.VEC_KNJIZENO]: {
    label: "Već knjiženo",
    kategorija: "vec_knjizeno",
    nacin: "BANK_VEC_KNJIZENO",
    allowIn: true,
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.DIREKTAN_TROSAK]: {
    label: "Direktan trošak",
    kategorija: "direktan_trosak",
    nacin: "BANK_DIREKTAN",
    allowOut: true,
  },
  [RASKNJIŽAVANJE_VRSTA.OSTALO]: {
    label: "Ostalo",
    kategorija: "ostalo",
    nacin: "BANK_OSTALO",
    allowIn: true,
    allowOut: true,
  },
};

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
