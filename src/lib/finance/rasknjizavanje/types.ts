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
  /** Operativni troškovi poslovanja bez A4 fakture (gorivo, AI servisi, reprezentacija, alat, smještaj...) */
  TROSAK_POSLOVANJA: "TROSAK_POSLOVANJA",
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
  [RASKNJIŽAVANJE_VRSTA.TROSAK_POSLOVANJA]: {
    label: "Trošak poslovanja",
    kategorija: "trosak_poslovanja",
    nacin: "BANK_TROSAK",
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


export const BUSINESS_EXPENSE_CATEGORIES = [
  { id: "GORIVO", label: "Gorivo i putarine", icon: "⛽", keywords: ["nesk", "petrol", "ina", "gazprom", "benz", "nafta", "gorivo", "pumpa", "hifa", "holdina", "zelir", "siniua"] },
  { id: "AI_CLOUD", label: "AI, Softver & Cloud (ChatGPT, Claude, Hosting)", icon: "🤖", keywords: ["openai", "chatgpt", "claude", "anthropic", "hetzner", "google", "aws", "github", "cursor", "midjourney", "microsoft", "apple", "digitalocean", "cloudflare", "contabo"] },
  { id: "SMJESTAJ_PUT", label: "Smještaj & Putni troškovi (Dnevnice, hoteli)", icon: "🏨", keywords: ["hotel", "motel", "apartman", "booking", "airbnb", "avio", "put", "smjestaj"] },
  { id: "REPREZENTACIJA", label: "Reprezentacija & Poslovni ručkovi", icon: "☕", keywords: ["restoran", "kafe", "cafe", "pizzeria", "hrana", "konoba", "bar", "lounge"] },
  { id: "ALAT_RADIONICA", label: "Alat & Radionica", icon: "🔧", keywords: ["alat", "wuerth", "wurth", "bau", "bosch", "makita", "hobi"] },
  { id: "REPROMATERIJAL", label: "Repromaterijal & Potrošni dijelovi", icon: "🔩", keywords: ["repro", "materijal", "dijel", "cijev", "kabel", "vijci"] },
  { id: "OPREMA_IT", label: "IT oprema, hardver & elektronika", icon: "💻", keywords: ["racunar", "laptop", "monitor", "mis", "tastatur", "servis", "elektronik", "gigatron"] },
  { id: "OSNOVNA_SREDSTVA", label: "Osnovna sredstva & Krupni inventar", icon: "🏢", keywords: ["inventar", "namjestaj", "masina", "uredjaj"] },
  { id: "KANCELARIJA", label: "Kancelarijski materijal & Higijena", icon: "📎", keywords: ["kancelar", "papir", "toner", "hemija", "ciscen", "voda"] },
  { id: "POSTARINA", label: "Poštarina & Kurirske službe", icon: "📦", keywords: ["posta", "post", "dhl", "fedex", "euroexpress", "xpress", "kurir"] },
  { id: "TELEKOM", label: "Telekomunikacije & Internet", icon: "📱", keywords: ["telekom", "mtel", "bht", "eronet", "telemach", "internet", "racun za telefon"] },
  { id: "REZIJE", label: "Komunalije & Režije (struja, voda)", icon: "💡", keywords: ["elektro", "struja", "vodovod", "komunal", "cistoca", "grijanje", "toplana"] },
  { id: "REGISTRACIJA_OSIGURANJE", label: "Registracija vozila & Osiguranje", icon: "🛡️", keywords: ["osigur", "registrac", "tehnicki", "amk", "kasko"] },
  { id: "MARKETING", label: "Marketing, Reklame & Oglašavanje", icon: "📢", keywords: ["marketing", "reklam", "meta", "facebook", "instagram", "ads"] },
  { id: "EDUKACIJA", label: "Kotizacije, seminari & stručna literatura", icon: "🎓", keywords: ["seminar", "kotizac", "kurs", "edukac", "knjig"] },
  { id: "OSTALI_TROSKOVI", label: "Ostali operativni troškovi poslovanja", icon: "📝", keywords: [] },
] as const;

export type BusinessExpenseCategoryId = (typeof BUSINESS_EXPENSE_CATEGORIES)[number]["id"];

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
  podkategorija?: string;
  placeno_km: number;
  preostalo_km: number;
  valuta: string;
  status_derived: string;
};

export type AllocationLine = {
  vrsta: RasknjizavanjeVrsta;
  iznos_km: number;
  podkategorija?: string;
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
