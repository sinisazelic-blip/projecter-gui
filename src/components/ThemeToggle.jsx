"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useTranslation } from "@/components/LocaleProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="btn"
      onClick={toggleTheme}
      title={theme === "dark" ? t("common.themeSwitchToLight") : t("common.themeSwitchToDark")}
      style={{
        minWidth: 44,
        padding: "10px 12px",
        fontSize: 18,
        lineHeight: 1,
      }}
      aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
