/**
 * FluxaSCB - Licensing & Activation Engine
 * Samostalni scoreboard kontroler za plivanje (Ares 21 / Splash LiveInfoServer).
 *
 * Bez aktivne licence aplikacija radi isključivo u Simulator modu.
 * Licenca (token) definiše paket (CORE / CGI / PRO) i tip trajanja (SINGLE_EVENT / MONTHLY).
 */

export const FLUXASCB_BASE_PACKAGES = [
  {
    id: "FLUXASCB_CORE_EVENT",
    tier: "CORE",
    billingMode: "SINGLE_EVENT",
    label: "FluxaSCB CORE (Jedan Event / 7 Dana)",
    durationDays: 7,
    priceKm: 100,
    priceEur: 50,
    description: "Osnovni SCB izlaz (glavni LED semafor + Operator) za jedno takmičenje (7 dana)",
  },
  {
    id: "FLUXASCB_CORE_MONTHLY",
    tier: "CORE",
    billingMode: "MONTHLY",
    label: "FluxaSCB CORE (Mjesečna Pretplata)",
    durationDays: 30,
    priceKm: 200,
    priceEur: 100,
    description: "Osnovni SCB izlaz (glavni LED semafor + Operator) — mjesečna pretplata",
  },
  {
    id: "FLUXASCB_CGI_EVENT",
    tier: "CGI",
    billingMode: "SINGLE_EVENT",
    label: "FluxaSCB CGI (Jedan Event / 7 Dana)",
    durationDays: 7,
    priceKm: 180,
    priceEur: 90,
    description: "CORE + 5-kanalni CGI Chroma Key broadcast za TV prenos i live stream (7 dana)",
  },
  {
    id: "FLUXASCB_CGI_MONTHLY",
    tier: "CGI",
    billingMode: "MONTHLY",
    label: "FluxaSCB CGI (Mjesečna Pretplata)",
    durationDays: 30,
    priceKm: 360,
    priceEur: 180,
    description: "CORE + 5-kanalni CGI Chroma Key broadcast za TV prenos i live stream — mjesečna pretplata",
  },
  {
    id: "FLUXASCB_PRO_EVENT",
    tier: "PRO",
    billingMode: "SINGLE_EVENT",
    label: "FluxaSCB PRO (Jedan Event / 7 Dana)",
    durationDays: 7,
    priceKm: 300,
    priceEur: 150,
    description: "CORE + CGI + mini displeji iznad startnih blokova (ESP32/Pi/TV) + dodjela medalja (7 dana)",
  },
  {
    id: "FLUXASCB_PRO_MONTHLY",
    tier: "PRO",
    billingMode: "MONTHLY",
    label: "FluxaSCB PRO (Mjesečna Pretplata)",
    durationDays: 30,
    priceKm: 600,
    priceEur: 300,
    description: "Kompletan FluxaSCB sistem (CORE + CGI + mini displeji po stazama + dodjela medalja) — mjesečna pretplata",
  },
] as const;

export type FluxaScbBasePackageId = (typeof FLUXASCB_BASE_PACKAGES)[number]["id"];
export type FluxaScbTier = "CORE" | "CGI" | "PRO";
export type FluxaScbBillingMode = "SINGLE_EVENT" | "MONTHLY";

export interface FluxaScbModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  isCore?: boolean;
}

export const FLUXASCB_MODULE_KEYS: FluxaScbModuleDefinition[] = [
  {
    key: "scbCore",
    label: "FluxaSCB Core (Semafor & Operator)",
    shortDesc: "Glavni LED scoreboard, Ares 21 TCP/Serial/COM konekcija i Splash LiveInfoServer",
    isCore: true,
  },
  {
    key: "cgiChroma",
    label: "CGI Chroma Key Broadcast",
    shortDesc: "5-kanalni CGI overlay (/cgi) + kalibracija staza za TV prenos i live stream",
  },
  {
    key: "laneDisplays",
    label: "Mini displeji iznad staza",
    shortDesc: "Web & JSON feed po stazi (/lane, /api/lane) za ESP32, Raspberry Pi i TV ekrane",
  },
  {
    key: "medalCeremony",
    label: "Dodjela medalja (Podium)",
    shortDesc: "Prikaz proglašenja pobjednika i svečane ceremonije na ekranima",
  },
];

export function getFluxaScbBasePackage(id: string | null | undefined) {
  return FLUXASCB_BASE_PACKAGES.find((p) => p.id === id) ?? FLUXASCB_BASE_PACKAGES[1];
}

export function isFluxaScbBasePackageId(id: string | null | undefined): boolean {
  const s = String(id || "").trim().toUpperCase();
  return FLUXASCB_BASE_PACKAGES.some((p) => p.id === s);
}

export function resolveFluxaScbTier(pkgId: string | null | undefined): FluxaScbTier {
  const pkg = getFluxaScbBasePackage(pkgId);
  return pkg.tier;
}

export function resolveFluxaScbBillingMode(pkgId: string | null | undefined): FluxaScbBillingMode {
  const pkg = getFluxaScbBasePackage(pkgId);
  return pkg.billingMode;
}

export function defaultModulesForFluxaScbPackage(
  pkgId: FluxaScbBasePackageId | string | null | undefined,
): Record<string, boolean> {
  const tier = resolveFluxaScbTier(pkgId);
  switch (tier) {
    case "PRO":
      return {
        scbCore: true,
        cgiChroma: true,
        laneDisplays: true,
        medalCeremony: true,
      };
    case "CGI":
      return {
        scbCore: true,
        cgiChroma: true,
        laneDisplays: false,
        medalCeremony: false,
      };
    case "CORE":
    default:
      return {
        scbCore: true,
        cgiChroma: false,
        laneDisplays: false,
        medalCeremony: false,
      };
  }
}
