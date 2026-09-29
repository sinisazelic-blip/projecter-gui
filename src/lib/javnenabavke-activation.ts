/**
 * DokumentArt — Studio licenciranje (paketi + moduli).
 * Službeni sekretarijat & protokol, javne nabavke, ugovori, digitalni potpis i zvanično dijeljenje.
 */

export const JAVNENABAVKE_BASE_PACKAGES = [
  {
    id: "JN_START",
    label: "DokumentArt Start (Protokol + JN)",
    priceKm: 80,
    priceEur: 40,
    description:
      "Službeni protokol i sekretarijat, plan javnih nabavki, uvoz Excela, statusi i praćenje rokova",
  },
  {
    id: "JN_PRO",
    label: "DokumentArt Standard (Protokol + JN + Ugovori)",
    priceKm: 120,
    priceEur: 60,
    description:
      "Start + Registar ugovora, aneksa i garancija, plafoni ugovora, Pantheon partneri i napredni izvještaji",
  },
  {
    id: "JN_ENTERPRISE",
    label: "DokumentArt Full Enterprise (E-potpis, Dijeljenje & Tunel)",
    priceKm: 180,
    priceEur: 90,
    description:
      "Kompletan paket: Kriptografski digitalni potpis, mobilne autorizacije, zvanično dijeljenje sa QR žigom, PIN zaštita i Cloud tunel",
  },
] as const;

export type JavneNabavkeBasePackageId =
  (typeof JAVNENABAVKE_BASE_PACKAGES)[number]["id"];

export interface JavneNabavkeModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  category: "PROTOKOL" | "JN" | "UGOVORI" | "SECURITY";
  categoryLabel: string;
  priceKm: number;
  priceEur: number;
  isCore?: boolean;
}

export const JAVNENABAVKE_MODULE_KEYS: JavneNabavkeModuleDefinition[] = [
  // 1. Protokol & Sekretarijat
  {
    key: "protokolCore",
    label: "Službeni protokol & Sekretarijat",
    shortDesc: "Ulazni, izlazni, interni protokoli, opticaj i uručenja",
    category: "PROTOKOL",
    categoryLabel: "📋 Protokol & Sekretarijat",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "vazniDokumenti",
    label: "Registar važnih akata",
    shortDesc: "Statut, osnivački akti, pravilnici, sistematizacija, odluke",
    category: "PROTOKOL",
    categoryLabel: "📋 Protokol & Sekretarijat",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },

  // 2. Javne Nabavke
  {
    key: "planNabavki",
    label: "Plan javnih nabavki",
    shortDesc: "Godišnji plan, Excel uvoz, statusi i faze nabavki",
    category: "JN",
    categoryLabel: "🏛️ Javne Nabavke",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "rokovi",
    label: "Rokovi i automatski podsjetnici",
    shortDesc: "Praćenje rokova, krugovi obavještavanja i alarmi",
    category: "JN",
    categoryLabel: "🏛️ Javne Nabavke",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },

  // 3. Ugovori & Finansije
  {
    key: "ugovori",
    label: "Registar ugovora & Aneksa",
    shortDesc: "Ugovori, aneksi, rokovi garancija i dokumentacija",
    category: "UGOVORI",
    categoryLabel: "📑 Ugovori & Finansije",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "partneri",
    label: "Partneri / dobavljači",
    shortDesc: "Lokalni registar partnera i kontakata",
    category: "UGOVORI",
    categoryLabel: "📑 Ugovori & Finansije",
    priceKm: 10,
    priceEur: 5,
  },
  {
    key: "plafoni",
    label: "Plafoni ugovora & Analitika",
    shortDesc: "Praćenje potrošnje po ugovorima vs ugovoreni plafon",
    category: "UGOVORI",
    categoryLabel: "📑 Ugovori & Finansije",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "pantheonSync",
    label: "Pantheon ERP sinhronizacija",
    shortDesc: "Automatsko čitanje partnera i knjiženja iz Pantheon-a",
    category: "UGOVORI",
    categoryLabel: "📑 Ugovori & Finansije",
    priceKm: 25,
    priceEur: 12,
  },
  {
    key: "izvjestaji",
    label: "Izvještaji za upravu",
    shortDesc: "PDF / Excel izvještaji o realizaciji plana i ugovora",
    category: "UGOVORI",
    categoryLabel: "📑 Ugovori & Finansije",
    priceKm: 15,
    priceEur: 8,
  },

  // 4. Digitalni Potpis, Zvanično Izdavanje & Sigurnost
  {
    key: "digitalniPotpis",
    label: "Elektronski potpis & Certifikati",
    shortDesc: "Kriptografski digitalni potpis, hash pečat i QR verifikacija",
    category: "SECURITY",
    categoryLabel: "🔒 E-potpis, Dijeljenje & Sigurnost",
    priceKm: 25,
    priceEur: 12,
  },
  {
    key: "potpisniUredjaji",
    label: "Mobilni autorizacioni uređaji",
    shortDesc: "Uparivanje telefona i tableta za mobilno odobravanje akata",
    category: "SECURITY",
    categoryLabel: "🔒 E-potpis, Dijeljenje & Sigurnost",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "zvanicnoDijeljenje",
    label: "Zvanično dijeljenje & QR Žig",
    shortDesc: "Službeni dispečerski žig, evidencija dijeljenja, PIN i download limiti",
    category: "SECURITY",
    categoryLabel: "🔒 E-potpis, Dijeljenje & Sigurnost",
    priceKm: 20,
    priceEur: 10,
  },
  {
    key: "cloudTunel",
    label: "Cloud Tunel & Javni pristup",
    shortDesc: "Siguran tunel za javnu verifikaciju i preuzimanje dokumenata",
    category: "SECURITY",
    categoryLabel: "🔒 E-potpis, Dijeljenje & Sigurnost",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "multiUser",
    label: "Više korisnika & Matrica prava",
    shortDesc: "Granularna kontrola prava po službama, modulima i stranicama",
    category: "SECURITY",
    categoryLabel: "🔒 E-potpis, Dijeljenje & Sigurnost",
    priceKm: 10,
    priceEur: 5,
  },
];

export function isJavneNabavkeBasePackageId(
  raw: string,
): raw is JavneNabavkeBasePackageId {
  return JAVNENABAVKE_BASE_PACKAGES.some((p) => p.id === raw);
}

export function getJavneNabavkeBasePackage(id: string | null | undefined) {
  const raw = String(id ?? "")
    .trim()
    .toUpperCase();
  return JAVNENABAVKE_BASE_PACKAGES.find((p) => p.id === raw) ?? null;
}

export function defaultModulesForJavneNabavkePackage(
  packageId: JavneNabavkeBasePackageId,
): Record<string, boolean> {
  switch (packageId) {
    case "JN_START":
      return {
        protokolCore: true,
        vazniDokumenti: true,
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: false,
        pantheonSync: false,
        izvjestaji: false,
        digitalniPotpis: false,
        potpisniUredjaji: false,
        zvanicnoDijeljenje: false,
        cloudTunel: false,
        multiUser: true,
      };
    case "JN_PRO":
      return {
        protokolCore: true,
        vazniDokumenti: true,
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: true,
        pantheonSync: true,
        izvjestaji: true,
        digitalniPotpis: false,
        potpisniUredjaji: false,
        zvanicnoDijeljenje: true,
        cloudTunel: false,
        multiUser: true,
      };
    case "JN_ENTERPRISE":
      return {
        protokolCore: true,
        vazniDokumenti: true,
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: true,
        pantheonSync: true,
        izvjestaji: true,
        digitalniPotpis: true,
        potpisniUredjaji: true,
        zvanicnoDijeljenje: true,
        cloudTunel: true,
        multiUser: true,
      };
    default:
      return {
        protokolCore: true,
        vazniDokumenti: true,
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: false,
        pantheonSync: false,
        izvjestaji: false,
        digitalniPotpis: false,
        potpisniUredjaji: false,
        zvanicnoDijeljenje: false,
        cloudTunel: false,
        multiUser: true,
      };
  }
}

export function calculateJavneNabavkePrice(
  packageId: JavneNabavkeBasePackageId,
  activeModules: Record<string, boolean>,
): { basePrice: number; addonsPrice: number; totalMonthly: number } {
  const pkg =
    getJavneNabavkeBasePackage(packageId) || JAVNENABAVKE_BASE_PACKAGES[0];
  const defaultMods = defaultModulesForJavneNabavkePackage(packageId);

  let addonsPrice = 0;
  for (const m of JAVNENABAVKE_MODULE_KEYS) {
    if (m.isCore) continue;
    const isChecked = Boolean(activeModules[m.key]);
    const isIncluded = Boolean(defaultMods[m.key]);
    if (isChecked && !isIncluded) addonsPrice += m.priceKm;
  }

  return {
    basePrice: pkg.priceKm,
    addonsPrice,
    totalMonthly: pkg.priceKm + addonsPrice,
  };
}
