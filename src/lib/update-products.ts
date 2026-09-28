import {
  getEnterSysBasePackage,
  resolveEnterSysBasePackageId,
} from "@/lib/entersys-activation";
import {
  normalizeStudioLicenceProfile,
  type StudioLicenceProfile,
} from "@/lib/studio-licence-profile";

/**
 * Imena foldera u FluxaUpdate. Mala slova, isto što klijent šalje kao product.
 * Licenca odlučuje koji folder token smije da vidi.
 */
export const UPDATE_PRODUCTS = [
  "fluxa",
  "soccs",
  "swimvoice",
  "docentre",
  "dokumentart",
  "fluxapos",
  "entersys",
  "enter",
  "argus",
  "poolmanager",
  "hallmanager",
  "fieldmanager",
  "gymmanager",
  "doorman",
  "locker",
  "rentals",
  "mojradio",
  "mojtv",
  "cctvgate",
  "eventmanager",
  "webshop",
] as const;

export type UpdateProductId = (typeof UPDATE_PRODUCTS)[number];

const ENTERSYS_MODULE_FOLDER: Record<string, UpdateProductId> = {
  enterCore: "enter",
  fluxaPos: "fluxapos",
  poolManager: "poolmanager",
  hallManager: "hallmanager",
  fieldManager: "fieldmanager",
  gymManager: "gymmanager",
  doorMan: "doorman",
  lockers: "locker",
  rentals: "rentals",
  mojRadio: "mojradio",
  mojTv: "mojtv",
  cctvGate: "cctvgate",
  eventManager: "eventmanager",
  webShop: "webshop",
};

function scopeKeys(scope: string | null | undefined): string[] {
  return String(scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function add(set: Set<UpdateProductId>, id: UpdateProductId) {
  set.add(id);
}

function entersysProducts(
  tier: string | null,
  scope: string | null,
): UpdateProductId[] {
  const set = new Set<UpdateProductId>(["entersys"]);
  let keys = scopeKeys(scope);
  if (keys.length === 0) {
    const pkg = resolveEnterSysBasePackageId({
      soccs_tier: tier,
      soccs_platform_scope: scope,
    });
    const base = getEnterSysBasePackage(pkg);
    keys = ["enterCore"];
    if (base && base.managerModule !== "enterCore")
      keys.push(base.managerModule);
  }
  for (const key of keys) {
    const folder = ENTERSYS_MODULE_FOLDER[key];
    if (folder) add(set, folder);
    if (key === "enterCore") add(set, "argus");
  }
  return [...set];
}

function soccsProducts(tier: string | null): UpdateProductId[] {
  if (
    String(tier ?? "")
      .trim()
      .toUpperCase() === "SWIMVOICE"
  )
    return ["swimvoice"];
  return ["soccs", "swimvoice"];
}

export function productsForLicence(input: {
  studio_licence_profile: string | null;
  soccs_tier: string | null;
  soccs_platform_scope: string | null;
}): UpdateProductId[] {
  const profile: StudioLicenceProfile | null = normalizeStudioLicenceProfile(
    input.studio_licence_profile,
  );
  if (!profile) return [];
  switch (profile) {
    case "FLUXA_ONLY":
      return ["fluxa"];
    case "SOCCS_SWIMVOICE":
      return soccsProducts(input.soccs_tier);
    case "FLUXA_AND_SOCCS":
      return ["fluxa", ...soccsProducts(input.soccs_tier)];
    case "DOCENTRE":
      return ["docentre"];
    case "JAVNENABAVKE":
      return ["dokumentart"];
    case "FLUXAPOS":
      return ["fluxapos"];
    case "ENTERSYS":
      return entersysProducts(input.soccs_tier, input.soccs_platform_scope);
    case "POOL_MANAGER":
      return ["poolmanager"];
    default:
      return [];
  }
}
