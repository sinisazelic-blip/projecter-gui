/**
 * Server component: ako su LICENCE_CHECK_URL i LICENCE_TOKEN postavljeni (klijentska instanca),
 * poziva master API za stanje licence. Ako allowed: false → prikazuje block stranicu.
 * Na MASTER instanci ove env varijable nisu postavljene, pa se provjera preskače.
 * Poruka: obratite se administratoru Fluxe (brand Fluxa, bez imena operatera).
 */
import { cookies } from "next/headers";
import { getValidLocale } from "@/lib/i18n";
import { getT } from "@/lib/translations";

export default async function LicenceCheckWrapper({ children }) {
  const url = process.env.LICENCE_CHECK_URL?.trim();
  const token = process.env.LICENCE_TOKEN?.trim();

  if (!url || !token) {
    return children;
  }

  let allowed = true;
  let reason = null;

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
    }
  } catch {
    allowed = true;
  }

  if (!allowed) {
    const cookieStore = await cookies();
    const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
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

  return children;
}
