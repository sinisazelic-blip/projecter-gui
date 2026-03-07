"use client";

import { getT } from "@/lib/translations";
import { getLocaleFromDocument } from "@/lib/i18n";

/**
 * Global error boundary. Mora biti Client Component i mora uključivati <html> i <body>
 * jer zamjenjuje root layout kada se aktivira.
 * U Next.js 16 bez ove datoteke može doći do greške u React Client Manifest
 * (Could not find the module ... global-error.js).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = typeof document !== "undefined" ? getLocaleFromDocument() : "sr";
  const t = getT(locale);

  return (
    <html lang={locale === "en" ? "en" : "bs"}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f0f0f", color: "#e5e5e5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t("globalError.title")}</h1>
          <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 20 }}>{error?.message ?? t("globalError.fallbackMessage")}</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(255,255,255,.08)",
              color: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("globalError.tryAgain")}
          </button>
        </div>
      </body>
    </html>
  );
}
