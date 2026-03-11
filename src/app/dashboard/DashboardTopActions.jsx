"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";
import { useAuthUser } from "@/components/AuthUserProvider";
import { useState, useRef, useEffect } from "react";
import { FLUXA_EDITIONS } from "@/lib/fluxa-edition";

export default function DashboardTopActions() {
  const { t } = useTranslation();
  const { edition, setEdition, isOwner, isFeatureVisible } = useFluxaEdition();
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

  const { canSee, onboardingCompleted, completeOnboarding } = useAuthUser();
  const tenantAdminEnabled = process.env.NEXT_PUBLIC_ENABLE_TENANT_ADMIN === "true";
  const showLicenceLink = isFeatureVisible(3) && tenantAdminEnabled;
  const showLicenceComingSoon = isFeatureVisible(3) && !tenantAdminEnabled;
  const showVerzijaDropdown = isOwner;
  const showMobile = isFeatureVisible(5) && canSee("Mobile dashboard", "-");
  const showBlagajna = isFeatureVisible(6) && canSee("Blagajna", "");

  return (
    <div className="actions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {!onboardingCompleted && (
        <button type="button" className="btn" onClick={completeOnboarding} style={{ fontSize: 13 }}>
          Skip tour
        </button>
      )}
      {showLicenceLink && (
        <Link href="/studio/licence" className="btn" title={t("dashboard.licenceTitle")}>
          🔐 {t("dashboard.licenceLabel")}
        </Link>
      )}
      {showLicenceComingSoon && (
        <span
          className="btn btn--disabled"
          style={{
            opacity: 0.6,
            cursor: "not-allowed",
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
          }}
          title={t("dashboard.licenceTitle")}
        >
          🔐 {t("dashboard.licenceLabel")}
        </span>
      )}

      {showVerzijaDropdown && (
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setVersionOpen((v) => !v)}
            title={t("dashboard.versionTitle")}
            style={{ minWidth: 100 }}
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
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
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
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!showVerzijaDropdown && (
        <Link
          href="/owner-login"
          className="btn"
          title={t("dashboard.ownerAccessTitle")}
          style={{ opacity: 0.85, fontSize: 13 }}
        >
          🔐 {t("dashboard.ownerAccess")}
        </Link>
      )}
      {showMobile && (
        <Link href="/mobile" className="btn" title={t("nav.mobileTitle")}>
          📱 {t("nav.mobile")}
        </Link>
      )}
      {showBlagajna && (
        <Link href="/cash" className="btn" title={t("nav.cashTitle")}>
          💰 {t("nav.cash")}
        </Link>
      )}

      <Link href="/uputstvo" className="btn" title={t("nav.uputstvoTitle")}>
        📖 {t("nav.uputstvo")}
      </Link>

      <button
        type="button"
        className="btn"
        title={t("common.logout")}
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/";
        }}
      >
        {t("common.logout")}
      </button>
    </div>
  );
}
