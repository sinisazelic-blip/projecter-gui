/**
 * Pragovi i potpisi za licence alert job.
 * Tekstualna pravila: docs/licence-alert-spec.md
 */

/** Jedan „najgori” tag za pretplatu (istek / preostali dani). */
export function resolveExpiryAlertTag(daysUntilEnd: number): string | null {
  if (!Number.isFinite(daysUntilEnd)) return null;
  if (daysUntilEnd < 0) return "SUB_EXPIRED";
  if (daysUntilEnd === 0) return "SUB_D0";
  if (daysUntilEnd <= 1) return "SUB_LE1";
  if (daysUntilEnd <= 7) return "SUB_LE7";
  if (daysUntilEnd <= 14) return "SUB_LE14";
  if (daysUntilEnd <= 30) return "SUB_LE30";
  return null;
}

/** Upozorenja za MEET kodove samo ako tenant ima SOCCS tier (kupac SOCCS/SwimVoice). */
export function resolveMeetAlertTag(
  meetRemaining: number,
  hasSoccsTier: boolean,
): string | null {
  if (!hasSoccsTier) return null;
  if (!Number.isFinite(meetRemaining)) return null;
  if (meetRemaining <= 0) return "MEET_0";
  if (meetRemaining === 1) return "MEET_1";
  return null;
}

export function buildLicenceAlertSignature(
  parts: (string | null | undefined)[],
): string | null {
  const s = parts.filter(Boolean) as string[];
  if (s.length === 0) return null;
  return [...new Set(s)].sort().join("|");
}

export type LicenceWarningSeverity = "info" | "warning" | "critical";

/** Polje u JSON odgovoru `GET /api/public/licence-check` (klijenti: Fluxa, SOCCS, …). */
export type LicenceWarningDto = {
  code: string;
  severity: LicenceWarningSeverity;
};

function severityForWarningCode(code: string): LicenceWarningSeverity {
  if (code === "SUB_D0" || code === "MEET_0") return "critical";
  if (code === "SUB_LE1" || code === "SUB_LE7" || code === "MEET_1") {
    return "warning";
  }
  if (code === "SUB_LE14" || code === "SUB_LE30") return "info";
  return "warning";
}

/**
 * Upozorenja dok je pretplata još „dozvoljena” (allowed === true).
 * Ne uključuje SUB_EXPIRED — tada je već allowed === false.
 */
export function buildLicenceWarnings(params: {
  daysUntilEnd: number;
  meetRemaining: number;
  hasSoccsTier: boolean;
}): LicenceWarningDto[] {
  const out: LicenceWarningDto[] = [];
  const exp = resolveExpiryAlertTag(params.daysUntilEnd);
  const meet = resolveMeetAlertTag(params.meetRemaining, params.hasSoccsTier);
  if (exp && exp !== "SUB_EXPIRED") {
    out.push({ code: exp, severity: severityForWarningCode(exp) });
  }
  if (meet) {
    out.push({ code: meet, severity: severityForWarningCode(meet) });
  }
  return out;
}

export function describeAlertTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    switch (t) {
      case "SUB_EXPIRED":
        out.push("Pretplata: datum isteka je prošao.");
        break;
      case "SUB_D0":
        out.push("Pretplata: posljednji dan važenja (danas).");
        break;
      case "SUB_LE1":
        out.push("Pretplata: ostalo najviše 1 dan do isteka.");
        break;
      case "SUB_LE7":
        out.push("Pretplata: ostalo 7 ili manje dana do isteka.");
        break;
      case "SUB_LE14":
        out.push("Pretplata: ostalo 14 ili manje dana do isteka.");
        break;
      case "SUB_LE30":
        out.push("Pretplata: ostalo 30 ili manje dana do isteka.");
        break;
      case "MEET_0":
        out.push("SOCCS: nema preostalih MEET_SESSION kodova.");
        break;
      case "MEET_1":
        out.push("SOCCS: preostao je samo jedan MEET_SESSION kod.");
        break;
      default:
        out.push(t);
    }
  }
  return out;
}
