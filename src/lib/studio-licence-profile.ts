/** Plan u `plans` koji označava da tenant nema Fluxa pretplatu (samo SOCCS/SwimVoice). */
export const STUDIO_STUB_NO_FLUXA_PLAN_NAZIV = "— (bez Fluxa paketa)";

export const STUDIO_LICENCE_PROFILES = [
  "FLUXA_ONLY",
  "SOCCS_SWIMVOICE",
  "FLUXA_AND_SOCCS",
  "DOCENTRE",
  "ENTERSYS",
  /** Legacy — više se ne nudi u UI; ostaje radi starih redova u bazi. */
  "POOL_MANAGER",
] as const;

export type StudioLicenceProfile = (typeof STUDIO_LICENCE_PROFILES)[number];

/** Tabovi tenant centra — svaki proizvod ima svoj sloj (različita tržišta i klijenti). */
export const TENANT_PRODUCT_TABS = [
  "FLUXA",
  "SOCCS_SV",
  "DOCENTRE",
  "ENTERSYS",
] as const;

export type TenantProductTab = (typeof TENANT_PRODUCT_TABS)[number];

/** U kojim tabovima se tenant prikazuje (kombinovani Fluxa+SOCCS u oba). */
export function profileToTabs(profile: StudioLicenceProfile): TenantProductTab[] {
  switch (profile) {
    case "FLUXA_ONLY":
      return ["FLUXA"];
    case "SOCCS_SWIMVOICE":
      return ["SOCCS_SV"];
    case "FLUXA_AND_SOCCS":
      return ["FLUXA", "SOCCS_SV"];
    case "DOCENTRE":
      return ["DOCENTRE"];
    case "ENTERSYS":
      return ["ENTERSYS"];
    case "POOL_MANAGER":
      // Legacy: nema više taba — ne prikazuj u listama proizvoda.
      return [];
  }
}

/** Profili koji koriste SOCCS-ov mehanizam aktivacije (FIRST_INSTALL kod + dani do isteka). */
export function profileUsesActivationCodes(
  profile: StudioLicenceProfile,
): boolean {
  return profile !== "FLUXA_ONLY" && profile !== "ENTERSYS";
}

/** App vrijednost za aktivacione kodove i verify (kolona soccs_activation_codes.app). */
export function profileToActivationApp(
  profile: StudioLicenceProfile,
): "SOCCS" | "DOCENTRE" | null {
  switch (profile) {
    case "SOCCS_SWIMVOICE":
    case "FLUXA_AND_SOCCS":
      return "SOCCS";
    case "DOCENTRE":
      return "DOCENTRE";
    default:
      return null;
  }
}

/** Korak 3 čarobnjaka: Fluxa (plan, max korisnika). */
export function studioWizardStep3ShowsFluxaBlock(
  profile: StudioLicenceProfile,
): boolean {
  return profile === "FLUXA_ONLY" || profile === "FLUXA_AND_SOCCS";
}

export function normalizeStudioLicenceProfile(
  raw: string | null | undefined,
): StudioLicenceProfile | null {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!u) return null;
  return (STUDIO_LICENCE_PROFILES as readonly string[]).includes(u)
    ? (u as StudioLicenceProfile)
    : null;
}

/** Za prikaz u Studio tablici: eksplicitna kolona ili zaključak iz plana / SOCCS tier-a (stari tenanti). */
export function resolveDisplayStudioProfile(row: {
  studio_licence_profile?: string | null;
  plan_naziv: string;
  soccs_tier?: string | null;
}): StudioLicenceProfile {
  const fromCol = normalizeStudioLicenceProfile(row.studio_licence_profile);
  if (fromCol) return fromCol;
  const hasSoccs = Boolean(String(row.soccs_tier ?? "").trim());
  const stub = row.plan_naziv === STUDIO_STUB_NO_FLUXA_PLAN_NAZIV;
  if (stub && hasSoccs) return "SOCCS_SWIMVOICE";
  if (!hasSoccs) return "FLUXA_ONLY";
  return "FLUXA_AND_SOCCS";
}
