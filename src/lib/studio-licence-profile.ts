/** Plan u `plans` koji označava da tenant nema Fluxa pretplatu (samo SOCCS/SwimVoice). */
export const STUDIO_STUB_NO_FLUXA_PLAN_NAZIV = "— (bez Fluxa paketa)";

export const STUDIO_LICENCE_PROFILES = [
  "FLUXA_ONLY",
  "SOCCS_SWIMVOICE",
  "FLUXA_AND_SOCCS",
] as const;

export type StudioLicenceProfile = (typeof STUDIO_LICENCE_PROFILES)[number];

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
