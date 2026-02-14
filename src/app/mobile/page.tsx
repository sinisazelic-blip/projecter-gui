import Link from "next/link";
import MobileDashboardClient from "./MobileDashboardClient";

export const dynamic = "force-dynamic";

const BTN_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: "24px 28px",
  fontSize: 20,
  fontWeight: 800,
  borderRadius: 20,
  textAlign: "center" as const,
  textDecoration: "none",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: 10,
  border: "2px solid",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

export default function MobilePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        padding: "24px 20px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img
          src="/fluxa/logo-light.png"
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
          Mobile
        </div>
      </div>

      {/* Owner Dashboard – brzi pregled */}
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
          Pregled
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
            "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.08))",
          borderColor: "rgba(34, 197, 94, 0.4)",
          color: "rgba(134, 239, 172, 0.98)",
          boxShadow: "0 8px 32px rgba(34, 197, 94, 0.15)",
        }}
      >
        <span style={{ fontSize: 36 }}>🎛️</span>
        <span>StrategicCore</span>
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>
          Brzi budžet u pregovorima
        </span>
      </Link>

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
        <span>🏠 Fluxa (puna verzija)</span>
      </Link>
    </div>
  );
}
