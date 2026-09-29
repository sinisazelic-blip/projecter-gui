"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { useAuthUser } from "@/components/AuthUserProvider";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";
import { FLUXA_EDITIONS } from "@/lib/fluxa-edition";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import FluxaLogo from "@/components/FluxaLogo";
import { FLUXA_SLOGAN_WITH_VERSION } from "@/lib/fluxaVersion";

export default function FirmaHeader({ hideLanguage = false }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestTourOnce } = useAuthUser();
  const { edition, setEdition, isOwner } = useFluxaEdition();
  const [versionOpen, setVersionOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setVersionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartTour = () => {
    requestTourOnce();
    router.push("/dashboard");
  };

  return (
    <div className="topRow">
      <div className="brandWrap">
        <div className="brandLogoBlock">
          <FluxaLogo />
          <span className="brandSlogan">{FLUXA_SLOGAN_WITH_VERSION}</span>
        </div>
        <div>
          <div className="brandTitle">{t("firma.title")}</div>
          <div className="brandSub">{t("firma.subtitle")}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <ThemeToggle />
        {!hideLanguage && <LanguageSwitcher />}

        {/* Izbor verzije software-a */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setVersionOpen((v) => !v)}
            title={t("dashboard.versionTitle") || "Izbor verzije software-a"}
            style={{ minWidth: 90, fontWeight: 700 }}
          >
            {edition} ▾
          </button>
          {versionOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 6,
                background: "var(--panel, #18181b)",
                border: "1px solid var(--border, #27272a)",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                zIndex: 50,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              {FLUXA_EDITIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setEdition(v);
                    setVersionOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    background: edition === v ? "rgba(125,211,252,0.15)" : "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: edition === v ? 700 : 400,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dugme Uputstvo */}
        <Link
          href="/uputstvo"
          className="btn"
          title={t("nav.uputstvoTitle") || "Korisničko uputstvo"}
        >
          📖 {t("nav.uputstvo") || "Uputstvo"}
        </Link>

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
