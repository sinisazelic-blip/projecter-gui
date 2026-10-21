/**
 * FluxaX NET Audio Ecosystem - Licensing & Activation Engine
 * Upravljanje licencama za audio studije, StudioBridge i Client Hub.
 */

export const FLUXAX_NET_BASE_PACKAGES = [
  {
    id: "FLUXAX_SESSION_7D",
    label: "FluxaX Sesija (7 Dana)",
    durationDays: 7,
    priceKm: 60,
    priceEur: 30,
    maxInOutputs: 16,
    description: "Kratkoročna projektna licenca za jednokratna snimanja i freelance termine (7 dana rada)",
  },
  {
    id: "FLUXAX_STUDIO_MONTHLY",
    label: "FluxaX Studio (Mjesečna Pretplata)",
    durationDays: 30,
    priceKm: 160,
    priceEur: 80,
    maxInOutputs: 32,
    description: "Standardna licenca za profesionalne audio studije sa punim pristupom Client Hub portalu (30 dana)",
  },
  {
    id: "FLUXAX_PRO_ANNUAL",
    label: "FluxaX Pro Master (Godišnja Licenca)",
    durationDays: 365,
    priceKm: 1500,
    priceEur: 750,
    maxInOutputs: 64,
    description: "Godišnja licenca za neograničeno snimanje, višekanalnu FluxaX matricu i prioritetni WebRTC tunel",
  },
] as const;

export type FluxaXNetBasePackageId = (typeof FLUXAX_NET_BASE_PACKAGES)[number]["id"];

export interface FluxaXNetModuleDefinition {
  key: string;
  label: string;
  shortDesc: string;
  category: "AUDIO_CORE" | "COLLAB" | "SECURITY";
  categoryLabel: string;
  icon: string;
  isCore?: boolean;
}

export const FLUXAX_NET_MODULE_KEYS: FluxaXNetModuleDefinition[] = [
  {
    key: "studioBridge",
    label: "FluxaX StudioBridge Core",
    shortDesc: "Lokalni audio ruter i hardverski skener",
    category: "AUDIO_CORE",
    categoryLabel: "🎛️ Audio Jezgro",
    icon: "🎚️",
    isCore: true,
  },
  {
    key: "matrixEngine",
    label: "FluxaX Routing Matrix",
    shortDesc: "Dante-grade kroslink matrica, nazivi kanala i .fluxax layouti",
    category: "AUDIO_CORE",
    categoryLabel: "🎛️ Audio Jezgro",
    icon: "⚡",
    isCore: true,
  },
  {
    key: "clientHub",
    label: "FluxaX Web Client Hub",
    shortDesc: "Online režijski portal za agencije i klijente sa video preview-om",
    category: "COLLAB",
    categoryLabel: "🌐 Saradnja na Daljinu",
    icon: "📡",
  },
  {
    key: "zeroBleed",
    label: "Zero-Bleed Zaštita",
    shortDesc: "Automatsko sprečavanje preslušavanja klijentskog zvuka u DAW",
    category: "SECURITY",
    categoryLabel: "🛡️ Studijska Sigurnost",
    icon: "🛡️",
    isCore: true,
  },
  {
    key: "lanCollab",
    label: "LAN Multi-Device Režija",
    shortDesc: "Povezivanje režisera i glumaca unutar studijske mreže",
    category: "COLLAB",
    categoryLabel: "🌐 Saradnja na Daljinu",
    icon: "💻",
  },
];

export function getFluxaXNetBasePackage(id: string | null | undefined) {
  return FLUXAX_NET_BASE_PACKAGES.find((p) => p.id === id) ?? FLUXAX_NET_BASE_PACKAGES[1];
}

export function defaultModulesForFluxaXNetPackage(pkgId: FluxaXNetBasePackageId): Record<string, boolean> {
  switch (pkgId) {
    case "FLUXAX_SESSION_7D":
      return {
        studioBridge: true,
        matrixEngine: true,
        clientHub: true,
        zeroBleed: true,
        lanCollab: false,
      };
    case "FLUXAX_STUDIO_MONTHLY":
    case "FLUXAX_PRO_ANNUAL":
    default:
      return {
        studioBridge: true,
        matrixEngine: true,
        clientHub: true,
        zeroBleed: true,
        lanCollab: true,
      };
  }
}
