"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { VALID_LOCALES } from "@/lib/i18n";

const localeLabels = { sr: "Srpski", en: "English" };

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label htmlFor="locale-select" className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
        {t("common.language")}:
      </label>
      <select
        id="locale-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.2)",
          background: "rgba(255,255,255,.08)",
          color: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
        title={t("common.language")}
      >
        {VALID_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {localeLabels[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
