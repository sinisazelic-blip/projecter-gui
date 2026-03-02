"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function FirmaHeader() {
  const { t } = useTranslation();

  return (
    <div className="topRow">
      <div className="brandWrap">
        <div className="brandLogoBlock">
          <img
            src="/fluxa/logo-light.png"
            alt="FLUXA"
            className="brandLogo"
          />
          <span className="brandSlogan">Project & Finance Engine</span>
        </div>
        <div>
          <div className="brandTitle">{t("firma.title")}</div>
          <div className="brandSub">{t("firma.subtitle")}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <LanguageSwitcher />
        <Link href="/studio/users" className="btn" title={t("dashboard.usersTitle")}>
          👤 {t("dashboard.users")}
        </Link>
        <Link href="/studio/roles" className="btn" title={t("dashboard.rolesTitle")}>
          🎭 {t("dashboard.roles")}
        </Link>
        <Link href="/dashboard" className="btn" title={t("firma.backToDashboard")}>
          🏠 {t("common.dashboard")}
        </Link>
      </div>
    </div>
  );
}
