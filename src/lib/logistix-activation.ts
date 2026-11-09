/**
 * LogistiX Heavy Fleet & Transport ERP - Licensing & Activation Engine
 * Upravljanje licencama za teretne autoprevoznike, dispečerske centre i flotu.
 */

export const LOGISTIX_BASE_PACKAGES = [
  {
    id: "LOGISTIX_PILOT_DEMO",
    label: "LogistiX Pilot (Demo 30 Dana)",
    durationDays: 30,
    priceKm: 0,
    priceEur: 0,
    maxTrucks: 5,
    description: "Probni period za prevoznika: do 5 šlepera, digitalni CMR i dispečerski nalozi (30 dana)",
  },
  {
    id: "LOGISTIX_FLEET_MONTHLY",
    label: "LogistiX Flota (Mjesečna Pretplata)",
    durationDays: 30,
    priceKm: 160,
    priceEur: 80,
    maxTrucks: 15,
    description: "Standardna licenca za prevozničke firme do 15 kamiona sa A4 fiskalnim fakturisanjem i AETR satovima",
  },
  {
    id: "LOGISTIX_PRO_ANNUAL",
    label: "LogistiX Enterprise Pro (Godišnja Licenca)",
    durationDays: 365,
    priceKm: 1500,
    priceEur: 750,
    maxTrucks: 50,
    description: "Godišnja licenca za veliku flotu: neograničeno šlepera, Vlasnički Cloud Tunel, FMS CAN telemetrija i API integracije",
  },
] as const;

export type LogistixBasePackageId = (typeof LOGISTIX_BASE_PACKAGES)[number]["id"];

export interface LogistixModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  category: "FLEET_CORE" | "DISPATCH" | "FINANCE" | "TELEMETRY";
  categoryLabel: string;
  icon: string;
  isCore?: boolean;
}

export const LOGISTIX_MODULE_KEYS: LogistixModuleDefinition[] = [
  {
    key: "flotaVozila",
    label: "Registar Flote & Šlepera",
    shortDesc: "Evidencija tegljača, poluprikolica, šofera i registracija",
    category: "FLEET_CORE",
    categoryLabel: "🚛 Flotno Jezgro",
    icon: "🚛",
    isCore: true,
  },
  {
    key: "dispecerNalozi",
    label: "Dispozicije & Nalozi za Prevoz",
    shortDesc: "Otvaranje tura, relacije, dodjela kamiona i praćenje statusa",
    category: "DISPATCH",
    categoryLabel: "📋 Dispečerski Pult",
    icon: "📋",
    isCore: true,
  },
  {
    key: "cmrVault",
    label: "Digitalni CMR Trezor",
    shortDesc: "Foto dokaz istovara sa telefona vozača i digitalna arhiva",
    category: "DISPATCH",
    categoryLabel: "📋 Dispečerski Pult",
    icon: "📄",
    isCore: true,
  },
  {
    key: "b2bFiskal",
    label: "A4 Fakturisanje & Fiskalni QR",
    shortDesc: "Izdavanje A4 deviznih i domaćih faktura sa QR verifikacijom Poreske uprave",
    category: "FINANCE",
    categoryLabel: "💶 Finansije & Fakture",
    icon: "💶",
  },
  {
    key: "paletniSaldo",
    label: "Euro-Palete Saldo & Dugovanja",
    shortDesc: "Evidencija dugovanja zamjenskih paleta na rampama",
    category: "FINANCE",
    categoryLabel: "💶 Finansije & Fakture",
    icon: "📦",
  },
  {
    key: "iosKartice",
    label: "IOS Kartice & Odgoda Valute",
    shortDesc: "Analitičke kartice kupaca, rokovi plaćanja i opomene za kašnjenje",
    category: "FINANCE",
    categoryLabel: "💶 Finansije & Fakture",
    icon: "📊",
  },
  {
    key: "vlasnickiTunel",
    label: "Vlasnički Mobilni Cloud Tunel",
    shortDesc: "Pristup za direktora/vlasnika sa mobilnog telefona u realnom vremenu",
    category: "TELEMETRY",
    categoryLabel: "📡 Telemetrija & Tunel",
    icon: "📡",
  },
  {
    key: "tachoAetr",
    label: "AETR Tahograf Sat & Pauze",
    shortDesc: "Automatsko upozoravanje na istek radnih sati vozača (EU 561/2006)",
    category: "TELEMETRY",
    categoryLabel: "📡 Telemetrija & Tunel",
    icon: "⏱️",
  },
  {
    key: "preventivaServis",
    label: "Preventivni Servis & Održavanje",
    shortDesc: "Kilometraža do servisa ulja, filtera, guma i ADR kalibracija",
    category: "FLEET_CORE",
    categoryLabel: "🚛 Flotno Jezgro",
    icon: "🔧",
  },
];

export function getLogistixBasePackage(id: string | null | undefined) {
  const match = LOGISTIX_BASE_PACKAGES.find((p) => p.id === id);
  return match || LOGISTIX_BASE_PACKAGES[1]; // default: FLEET_MONTHLY
}

export function defaultModulesForLogistixPackage(pkgId: string | null | undefined): Record<string, boolean> {
  const isPilot = pkgId === "LOGISTIX_PILOT_DEMO";
  const isAnnual = pkgId === "LOGISTIX_PRO_ANNUAL";

  const res: Record<string, boolean> = {};
  for (const m of LOGISTIX_MODULE_KEYS) {
    if (m.isCore) {
      res[m.key] = true;
    } else if (isPilot) {
      res[m.key] = m.key === "cmrVault" || m.key === "b2bFiskal";
    } else if (isAnnual) {
      res[m.key] = true;
    } else {
      // Standard monthly
      res[m.key] = m.key !== "vlasnickiTunel";
    }
  }
  return res;
}
