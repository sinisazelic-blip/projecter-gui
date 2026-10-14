"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import FluxaLogo from "@/components/FluxaLogo";
import MasterSidebar from "@/components/MasterSidebar";
import LivingDesk from "./LivingDesk";
import AdminDesks from "./AdminDesks";
import ExecutiveInsightModal from "./ExecutiveInsightModal";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { useAuthUser } from "@/components/AuthUserProvider";

interface ModernDashboardProps {
  onSwitchToClassic?: () => void;
}

export default function ModernDashboard({ onSwitchToClassic }: ModernDashboardProps) {
  const { user, nivo } = useAuthUser();
  const [stats, setStats] = useState(null);
  const isOwnerOrAdmin = user?.user_id === 0 || user?.username === "Owner" || (nivo ?? 0) >= 8;
  const isOwner = user?.user_id === 0 || user?.username === "Owner" || user?.uloga_naziv === "Owner" || (nivo ?? 0) >= 9;

  useEffect(() => {
    document.cookie = "fluxa_dash_view=modern; path=/; max-age=31536000";
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setStats(d);
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSwitchClassic = () => {
    if (onSwitchToClassic) {
      onSwitchToClassic();
    } else {
      window.location.href = "/dashboard?view=classic";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        background: "#0b0f14",
        color: "#e8eef6",
        overflow: "hidden",
      }}
    >
      {/* 1. LIJEVI MENI (ŠIFARNICI & SISTEMSKA POSTAVKA) */}
      <MasterSidebar />

      {/* 2. GLAVNI RADNI PROSTOR */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* TOP HEADER */}
        <header
          style={{
            padding: "12px 24px",
            background: "#0c121b",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Brand info */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <FluxaLogo />
          </div>

          {/* Header Kontrole & Alati */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Toggle Switcher na Klasični pregled */}
            <button
              type="button"
              onClick={handleSwitchClassic}
              className="btn"
              title="Vrati se na originalni klasični operativni pult Fluxa"
              style={{
                height: 38,
                padding: "0 14px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                boxSizing: "border-box",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#cbd5e1",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <span>🏛️</span>
              <span>Klasični Pult</span>
            </button>

            {/* Workspace Switcher */}
            {isOwnerOrAdmin && <WorkspaceSwitcher />}

            {/* Blagajna (isključivo owner) */}
            {isOwner && (
              <Link
                href="/cash"
                className="btn"
                title="Personalna gotovinska blagajna"
                style={{
                  height: 38,
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  boxSizing: "border-box",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                💰 <span>Blagajna</span>
              </Link>
            )}

            {/* Diskretni pregled (Mobile podaci) - samo ikonica */}
            <ExecutiveInsightModal />

            {/* Odjava */}
            <button
              type="button"
              className="btn"
              style={{
                height: 38,
                padding: "0 14px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                boxSizing: "border-box",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
            >
              Odjava
            </button>
          </div>
        </header>

        {/* GLAVNI SCROLLABLE SADRŽAJ (STOLOVI & DINAMIKA) */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px 32px",
            maxWidth: 1600,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {/* NIVO 1: ŽIVI RADNI STO (Danas u radu vs 15-dnevni vremenski radar) */}
          <LivingDesk stats={stats} />

          {/* NIVO 2: ADMINISTRATIVNI STOLOVI (Fakture, Banka, Analitika) */}
          <AdminDesks stats={stats} />
        </main>
      </div>
    </div>
  );
}
