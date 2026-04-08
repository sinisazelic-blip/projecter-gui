import { createHmac } from "node:crypto";

export type SoccsTier =
  | "BASIC"
  | "BASIC_PLUS"
  | "PROFESSIONAL"
  | "ENTERPRISE"
  | "SWIMVOICE";

export function normalizeSoccsTier(raw: string | null | undefined): SoccsTier {
  const u = String(raw ?? "BASIC")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (
    u === "BASIC" ||
    u === "BASIC_PLUS" ||
    u === "PROFESSIONAL" ||
    u === "ENTERPRISE" ||
    u === "SWIMVOICE"
  ) {
    return u;
  }
  return "BASIC";
}

export function soccsTierToModules(tier: SoccsTier): Record<string, boolean> {
  switch (tier) {
    case "BASIC":
      return { soccs_core: true, swimvoice: false, cloud_sync: false };
    case "BASIC_PLUS":
      return { soccs_core: true, swimvoice: true, cloud_sync: false };
    case "PROFESSIONAL":
    case "ENTERPRISE":
      return { soccs_core: true, swimvoice: true, cloud_sync: true };
    case "SWIMVOICE":
      return { soccs_core: false, swimvoice: true, cloud_sync: false };
    default:
      return { soccs_core: true, swimvoice: false, cloud_sync: false };
  }
}

export function soccsTierToLimits(
  tier: SoccsTier,
): Record<string, number | null> {
  return {
    max_meets_per_year:
      tier === "ENTERPRISE" ? null : tier === "PROFESSIONAL" ? 24 : 6,
  };
}

export function signSoccsLicensePayload(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function buildSoccsLicenseJwtLike(opts: {
  tenantPublicId: string;
  tier: SoccsTier;
  subscriptionEndsAt: string;
  installationPublicId: string;
  purpose: "FIRST_INSTALL" | "MEET_SESSION";
}): { kind: string; expires_at: string | null; payload: string } {
  const secret = process.env.SOCCS_LICENSE_SIGNING_SECRET?.trim();
  const inner = {
    sub: opts.tenantPublicId,
    tier: opts.tier,
    exp: opts.subscriptionEndsAt,
    inst: opts.installationPublicId,
    purpose: opts.purpose,
    iat: new Date().toISOString(),
  };
  if (!secret) {
    return {
      kind: "unsigned_bundle",
      expires_at: opts.subscriptionEndsAt,
      payload: Buffer.from(JSON.stringify(inner), "utf8").toString("base64url"),
    };
  }
  return {
    kind: "signed_bundle",
    expires_at: opts.subscriptionEndsAt,
    payload: signSoccsLicensePayload(inner, secret),
  };
}
