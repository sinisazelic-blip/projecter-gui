"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";
import MobileDashboardClient from "./MobileDashboardClient";

const BTN_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "24px 28px",
  fontSize: 20,
  fontWeight: 800,
  borderRadius: 20,
  textAlign: "center",
  textDecoration: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  border: "2px solid",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

export default function MobilePage() {
  const { t } = useTranslation();

  return (
    <div
      style={{
        minHeight: "100dvh",
        padding: "24px 20px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <FluxaLogo
          alt="Fluxa"
          style={{ width: 80, height: 31, objectFit: "contain", opacity: 0.95 }}
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            fontWeight: 600,
            opacity: 0.7,
            letterSpacing: "0.08em",
          }}
        >
          {t("nav.mobile")}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            opacity: 0.6,
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          {t("mobile.overview")}
        </div>
        <MobileDashboardClient />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          margin: "8px 0",
        }}
      />

      <Link
        href="/studio/strategic-core"
        style={{
          ...BTN_STYLE,
          background:
            "linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.12))",
          borderColor: "rgba(234, 179, 8, 0.5)",
          color: "rgba(253, 224, 71, 0.98)",
          boxShadow: "0 8px 32px rgba(234, 179, 8, 0.2)",
        }}
      >
        <span style={{ fontSize: 36 }}>🎛️</span>
        <span>{t("dashboard.strategicCore")}</span>
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
          {t("mobile.scSubtitle")}
        </span>
      </Link>

      <Link
        href="/mobile/deals"
        style={{
          ...BTN_STYLE,
          background:
            "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))",
          borderColor: "rgba(59, 130, 246, 0.4)",
          color: "rgba(147, 197, 253, 0.98)",
          boxShadow: "0 8px 32px rgba(59, 130, 246, 0.15)",
        }}
      >
        <span style={{ fontSize: 36 }}>📋</span>
        <span>{t("mobile.dealsList")}</span>
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
          {t("mobile.dealsListSubtitle")}
        </span>
      </Link>

      <Link
        href="/mobile/pp"
        style={{
          ...BTN_STYLE,
          background:
            "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(126, 34, 206, 0.08))",
          borderColor: "rgba(168, 85, 247, 0.4)",
          color: "rgba(216, 180, 254, 0.98)",
          boxShadow: "0 8px 32px rgba(168, 85, 247, 0.15)",
        }}
      >
        <span style={{ fontSize: 36 }}>📊</span>
        <span>{t("mobile.ppList")}</span>
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
          {t("mobile.ppListSubtitle")}
        </span>
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          height: 1,
          background: "rgba(255,255,255,0.08)",
          margin: "8px 0",
        }}
      />

      <Link
        href="/dashboard"
        style={{
          ...BTN_STYLE,
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.9)",
          fontSize: 15,
          padding: "16px 24px",
        }}
      >
        <span>🏠 {t("mobile.fullVersion")}</span>
      </Link>
    </div>
  );
}
