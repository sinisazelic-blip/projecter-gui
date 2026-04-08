"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import { useAuthUser } from "@/components/AuthUserProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import FluxaLogo from "@/components/FluxaLogo";

export default function FirmaHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestTourOnce } = useAuthUser();

  const handleStartTour = () => {
    requestTourOnce();
    router.push("/dashboard");
  };

  return (
    <div className="topRow">
      <div className="brandWrap">
        <div className="brandLogoBlock">
          <FluxaLogo />
          <span className="brandSlogan">Project & Finance Engine · V2.0</span>
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
        <ThemeToggle />
        <LanguageSwitcher />
        <button
          type="button"
          className="btn"
          onClick={handleStartTour}
          title={t("firma.startTourTitle")}
        >
          <img
            src="/fluxa/Icon.ico"
            alt=""
            width={15}
            height={15}
            style={{
              display: "inline-block",
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />
          {t("firma.startTour")}
        </button>
        <Link
          href="/studio/users"
          className="btn"
          title={t("dashboard.usersTitle")}
        >
          👤 {t("dashboard.users")}
        </Link>
        <Link
          href="/studio/roles"
          className="btn"
          title={t("dashboard.rolesTitle")}
        >
          🎭 {t("dashboard.roles")}
        </Link>
        <Link
          href="/dashboard"
          className="btn"
          title={t("firma.backToDashboard")}
        >
          <img
            src="/fluxa/Icon.ico"
            alt=""
            style={{
              width: 18,
              height: 18,
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />{" "}
          {t("common.dashboard")}
        </Link>
      </div>
    </div>
  );
}
