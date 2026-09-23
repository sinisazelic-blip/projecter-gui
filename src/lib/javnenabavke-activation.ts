/**
 * JavneNabavke — Studio licenciranje (paketi + moduli).
 * Živi u tabu Dokumentar (isti sloj kao DocCentre), model kao FluxaPOS (token + licence-check).
 */

export const JAVNENABAVKE_BASE_PACKAGES = [
  {
    id: "JN_START",
    label: "JavneNabavke Start",
    priceKm: 80,
    priceEur: 40,
    description:
      "Plan nabavki, rokovi, ugovori i osnovni registri za javna preduzeća",
  },
  {
    id: "JN_PRO",
    label: "JavneNabavke Pro",
    priceKm: 120,
    priceEur: 60,
    description:
      "Start + Pantheon partneri, plafoni ugovora i napredniji izvještaji",
  },
  {
    id: "JN_ENTERPRISE",
    label: "JavneNabavke Enterprise",
    priceKm: 180,
    priceEur: 90,
    description:
      "Kompletan paket: svi moduli, više korisnika i puna Pantheon integracija",
  },
] as const;

export type JavneNabavkeBasePackageId =
  (typeof JAVNENABAVKE_BASE_PACKAGES)[number]["id"];

export interface JavneNabavkeModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  category: "CORE" | "INTEGRACIJE" | "UPRAVA";
  categoryLabel: string;
  priceKm: number;
  priceEur: number;
  isCore?: boolean;
}

export const JAVNENABAVKE_MODULE_KEYS: JavneNabavkeModuleDefinition[] = [
  {
    key: "planNabavki",
    label: "Plan nabavki",
    shortDesc: "Godišnji plan, Excel uvoz, statusi stavki",
    category: "CORE",
    categoryLabel: "Osnovne funkcije",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "rokovi",
    label: "Rokovi i podsjetnici",
    shortDesc: "Praćenje rokova, alerti",
    category: "CORE",
    categoryLabel: "Osnovne funkcije",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "ugovori",
    label: "Ugovori",
    shortDesc: "Registar ugovora i dokumentacija",
    category: "CORE",
    categoryLabel: "Osnovne funkcije",
    priceKm: 0,
    priceEur: 0,
    isCore: true,
  },
  {
    key: "partneri",
    label: "Partneri / dobavljači",
    shortDesc: "Lokalni registar partnera",
    category: "CORE",
    categoryLabel: "Osnovne funkcije",
    priceKm: 10,
    priceEur: 5,
  },
  {
    key: "plafoni",
    label: "Plafoni ugovora",
    shortDesc: "Praćenje potrošnje vs plafon",
    category: "UPRAVA",
    categoryLabel: "Uprava & analitika",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "izvjestaji",
    label: "Izvještaji",
    shortDesc: "PDF / Excel izvještaji i pregledi",
    category: "UPRAVA",
    categoryLabel: "Uprava & analitika",
    priceKm: 15,
    priceEur: 8,
  },
  {
    key: "pantheonSync",
    label: "Pantheon sinhronizacija",
    shortDesc: "Čitanje partnera i knjiženja iz Pantheon ERP-a",
    category: "INTEGRACIJE",
    categoryLabel: "Integracije",
    priceKm: 25,
    priceEur: 12,
  },
  {
    key: "multiUser",
    label: "Više korisnika / uloge",
    shortDesc: "Admin, referent, pregled",
    category: "UPRAVA",
    categoryLabel: "Uprava & analitika",
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
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: false,
        izvjestaji: false,
        pantheonSync: false,
        multiUser: true,
      };
    case "JN_PRO":
      return {
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: true,
        izvjestaji: true,
        pantheonSync: true,
        multiUser: true,
      };
    case "JN_ENTERPRISE":
      return {
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: true,
        izvjestaji: true,
        pantheonSync: true,
        multiUser: true,
      };
    default:
      return {
        planNabavki: true,
        rokovi: true,
        ugovori: true,
        partneri: true,
        plafoni: false,
        izvjestaji: false,
        pantheonSync: false,
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
