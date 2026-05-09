/**
 * Server component: ako su LICENCE_CHECK_URL i LICENCE_TOKEN postavljeni (klijentska instanca),
 * poziva master API za stanje licence. Ako allowed: false → prikazuje block stranicu.
 * Na MASTER instanci ove env varijable nisu postavljene, pa se provjera preskače.
 * Poruka: obratite se administratoru Fluxe (brand Fluxa, bez imena operatera).
 *
 * Kada je allowed: true, odgovor se prosljeđuje u `LicenceClientAlerts` (koverta + popup + kontekst).
 */
import { cookies } from "next/headers";
import LicenceClientAlerts from "@/components/LicenceClientAlerts";
import { getFluxaActivationState } from "@/lib/fluxa-activation";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";

export default async function LicenceCheckWrapper({ children }) {
  const envUrl = process.env.LICENCE_CHECK_URL?.trim();
  const envToken = process.env.LICENCE_TOKEN?.trim();
  const state = await getFluxaActivationState().catch(() => null);
  const dbUrl = state?.licence_check_url?.trim();
  const dbToken = state?.licence_token?.trim();
  const url = dbUrl || envUrl;
  const token = dbToken || envToken;

  if (!url || !token) {
    return children;
  }

  let allowed = true;
  let reason = null;
  let alertsPayload = null;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.allowed === false) {
      allowed = false;
      reason = data.reason || "suspended";
    } else if (res.ok && data && typeof data === "object") {
      const raw = Array.isArray(data.warnings) ? data.warnings : [];
      const warnings = raw
        .map((x) => ({
          code: String(x?.code ?? "").trim(),
          severity: String(x?.severity ?? "warning").trim(),
        }))
        .filter((x) => x.code);
      const days = Number(data.days_until_end);
      const meets = Number(data.meet_remaining);
      alertsPayload = {
        warnings,
        days_until_end: Number.isFinite(days) ? days : 0,
        meet_remaining: Number.isFinite(meets) ? meets : 0,
        subscription_ends_at:
          typeof data.subscription_ends_at === "string"
            ? data.subscription_ends_at
            : null,
        naziv: typeof data.naziv === "string" ? data.naziv : null,
        tenant_id:
          data.tenant_id != null && Number.isFinite(Number(data.tenant_id))
            ? Number(data.tenant_id)
            : null,
      };
    }
  } catch {
    allowed = true;
    alertsPayload = null;
  }

  if (!allowed) {
    const cookieStore = await cookies();
    const locale =
      getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
    const t = getT(locale);

    return (
      <div
        className="container"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>
            {reason === "suspended"
              ? t("licenceBlock.suspended")
              : reason === "expired"
                ? t("licenceBlock.expired")
                : t("licenceBlock.disabled")}
          </h1>
          <p style={{ marginBottom: 24, opacity: 0.9 }}>
            {t("licenceBlock.contact")}
          </p>
          <p style={{ fontSize: 14, opacity: 0.75 }}>
            {t("licenceBlock.contactError")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <LicenceClientAlerts initial={alertsPayload}>
      {children}
    </LicenceClientAlerts>
  );
}
