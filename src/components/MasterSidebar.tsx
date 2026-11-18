"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { FLUXA_VERSION } from "@/lib/fluxaVersion";
import {
  ClipboardList,
  Layers,
  Trophy,
  KeyRound,
  Receipt,
  FileText,
  Landmark,
  Calculator,
  Wallet,
  TrendingUp,
  BarChart3,
  PieChart,
  Users2,
  Briefcase,
  UserCheck,
  Mic,
  Tag,
  GitBranch,
  Building2,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Boxes,
  ScrollText,
  Percent,
  Coins
} from "lucide-react";
import { useAuthUser } from "@/components/AuthUserProvider";

const STORAGE_KEY = "fluxa_sidebar_sections_v2";

export default function MasterSidebar() {
  const pathname = usePathname();
  const { canSee, nivo, user } = useAuthUser();
  const [collapsed, setCollapsed] = useState(false);
  const isOwner = user?.user_id === 0 || user?.username === "Owner" || (nivo ?? 0) >= 8;

  // Stanje sklopivih sekcija (Glavni desk je uvijek otvoren i fiksiran)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    finance: false,
    analytics: false,
    sifarnici: false,
    system: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setOpenSections((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch {}
  }, []);

  const toggleSection = (secKey: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [secKey]: !prev[secKey] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 1. GLAVNI DESK (uvijek na vrhu, fiksiran, ne sklapa se)
  const mainDeskItems = [
    { label: "Deals (Pregovori)", href: "/inicijacije", icon: ClipboardList, color: "#60a5fa", show: true },
    { label: "Projekti (PP)", href: "/projects", icon: Layers, color: "#4ade80", show: true },
    { label: "Takmičenja", href: "/projects/meets", icon: Trophy, color: "#38bdf8", show: true },
    { label: "Master Hub Licenci", href: "/studio/licence", icon: KeyRound, color: "#f43f5e", show: isOwner },
  ];

  // 2. FINANSIJE - OPERATIVA (sklopivo)
  const financeItems = [
    { label: "Fakturisanje", href: "/fakture/za-fakturisanje", icon: Receipt, show: isOwner || canSee("Fakture", "") },
    { label: "KIF (Fakture)", href: "/fakture", icon: FileText, show: isOwner || canSee("Fakture", "") || canSee("Finansije - KIF", "") },
    { label: "Izvodi (Banka)", href: "/izvodi", icon: Landmark, show: isOwner || canSee("Finansije - Izvodi", "") },
    { label: "KUF (Ulazni)", href: "/finance/kuf", icon: ScrollText, show: isOwner || canSee("Finansije - KUF", "") },
    { label: "PDV Prijava", href: "/finance/pdv", icon: Percent, show: isOwner || canSee("Finansije - PDV", "") },
    { label: "Naplata & IOS", href: "/naplate", icon: Coins, show: isOwner || canSee("Naplate", "") },
    { label: "IOS & Alati", href: "/studio/finance-tools", icon: Calculator, show: isOwner || canSee("Finansije - Banka", "") },
    { label: "Mali Računi", href: "/finance/mali-racuni", icon: Wallet, show: isOwner || canSee("Mali računi", "") },
    { label: "Narudžbenice", href: "/narudzbenice", icon: Boxes, show: isOwner },
    { label: "Ponude", href: "/ponude", icon: FileText, show: isOwner },
  ];

  // 3. PROFIT & ANALITIKA (sklopivo)
  const analyticsItems = [
    { label: "Analitika (Puni Pult)", href: "/finance", icon: BarChart3, color: "#38bdf8", isSpecial: true, show: isOwner || canSee("Finansije - Banka", "") },
    { label: "Profit (Margin)", href: "/finance/profit", icon: TrendingUp, show: isOwner || canSee("Izvještaji", "") },
    { label: "Marža po Klijentu", href: "/finance/profit/klijent", icon: PieChart, show: isOwner || canSee("Izvještaji", "") },
    { label: "PURS Izvještaji (Svi)", href: "/izvjestaji/svi", icon: FileText, show: isOwner || canSee("Izvještaji", "") },
    { label: "Grafikoni (Charts)", href: "/izvjestaji/graficki", icon: BarChart3, show: isOwner || canSee("Izvještaji", "") },
  ];

  // 4. ŠIFARNICI (sklopivo)
  const sifarniciItems = [
    { label: "Klijenti", href: "/studio/klijenti", icon: Users2, show: true },
    { label: "Dobavljači", href: "/studio/dobavljaci", icon: Briefcase, show: true },
    { label: "Radnici & Ekipa", href: "/studio/radnici", icon: UserCheck, show: true },
    { label: "Saradnici (Talenti)", href: "/studio/talenti", icon: Mic, show: isOwner },
    { label: "Cjenovnik", href: "/studio/cjenovnik", icon: Tag, show: isOwner },
    { label: "Radne Faze", href: "/studio/radne-faze", icon: GitBranch, show: isOwner },
    { label: "Postavke Firme", href: "/studio/firma", icon: Building2, show: true },
  ];

  // 5. SISTEM (sklopivo)
  const systemItems = [
    { label: "Korisnici", href: "/studio/users", icon: Settings, show: isOwner || canSee("Šifarnici - Users", "") },
    { label: "Uloge i Prava", href: "/studio/roles", icon: ShieldCheck, show: isOwner || canSee("Šifarnici - Roles", "") },
  ];

  const renderNavList = (items: any[], compact = false) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items
          .filter((it) => it.show)
          .map((it, idx) => {
            const Icon = it.icon;
            const active = pathname === it.href;
            const itemColor = it.color || (active ? "#38bdf8" : "#9aa6b8");
            return (
              <Link
                key={idx}
                href={it.href}
                title={collapsed ? it.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: collapsed ? "8px 0" : compact ? "6px 8px" : "7px 9px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 7,
                  fontSize: compact ? 12.5 : 13,
                  fontWeight: active ? 700 : it.isSpecial ? 700 : 500,
                  color: active ? "#f8fafc" : it.isSpecial ? "#7dd3fc" : "#cbd5e1",
                  background: active
                    ? "#232b38"
                    : it.isSpecial
                      ? "rgba(56, 189, 248, 0.08)"
                      : "transparent",
                  border: active
                    ? "1px solid #3b495e"
                    : it.isSpecial
                      ? "1px solid rgba(56, 189, 248, 0.22)"
                      : "1px solid transparent",
                  boxShadow: active ? "inset 3px 0 0 #38bdf8" : "none",
                  textDecoration: "none",
                  transition: "all 0.14s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "#222834";
                    e.currentTarget.style.borderColor = "#2f3746";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = it.isSpecial ? "rgba(56, 189, 248, 0.08)" : "transparent";
                    e.currentTarget.style.borderColor = it.isSpecial ? "rgba(56, 189, 248, 0.22)" : "transparent";
                    e.currentTarget.style.color = it.isSpecial ? "#7dd3fc" : "#cbd5e1";
                  }
                }}
              >
                <span
                  style={{
                    width: compact ? 22 : 26,
                    height: compact ? 22 : 26,
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: active
                      ? "rgba(56, 189, 248, 0.15)"
                      : it.color
                        ? `${it.color}18`
                        : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${active ? "rgba(56, 189, 248, 0.35)" : it.color ? `${it.color}33` : "rgba(255, 255, 255, 0.06)"}`,
                  }}
                >
                  <Icon size={compact ? 13 : 14} strokeWidth={active || it.isSpecial ? 2.2 : 1.9} color={itemColor} />
                </span>
                {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>}
              </Link>
            );
          })}
      </div>
    );
  };

  const renderSectionHeader = (title: string, key: string, count: number) => {
    if (collapsed) {
      return (
        <div
          style={{
            height: 1,
            background: "rgba(255, 255, 255, 0.08)",
            margin: "8px 4px",
          }}
        />
      );
    }
    const isOpen = openSections[key];
    return (
      <button
        type="button"
        onClick={() => toggleSection(key)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 9px",
          background: isOpen ? "#1e2430" : "transparent",
          border: "none",
          color: isOpen ? "#e2e8f0" : "#94a3b8",
          cursor: "pointer",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.7px",
          textTransform: "uppercase",
          borderRadius: 7,
          transition: "all 0.12s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#222834";
          e.currentTarget.style.color = "#f8fafc";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isOpen ? "#1e2430" : "transparent";
          e.currentTarget.style.color = isOpen ? "#e2e8f0" : "#94a3b8";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>{title}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 999,
              background: "#232936",
              border: "1px solid #323a4a",
              color: "#94a3b8",
            }}
          >
            {count}
          </span>
        </div>
        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
    );
  };

  return (
    <aside
      style={{
        width: collapsed ? 64 : 246,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "#181d25",
        borderRight: "1px solid #2b3240",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid #262d3b",
          background: "#1b2029",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                letterSpacing: "0.4px",
              }}
            >
              ST
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "0.3px", color: "#f1f5f9" }}>
              Studio TAF
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "#232936",
            border: "1px solid #3b4252",
            color: "#e2e8f0",
            borderRadius: 6,
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title={collapsed ? "Proširi meni" : "Skupi meni"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav List (Scrollable) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 9px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* =========================================================
            1. GLAVNI DESK (UVIJEK VIDLJIV, NE SKLAPA SE)
            ========================================================= */}
        <div
          style={{
            background: "#141820",
            border: "1px solid #262d3b",
            borderRadius: 10,
            padding: collapsed ? "6px 4px" : "8px 6px",
          }}
        >
          {!collapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.8px",
                color: "#7dd3fc",
                padding: "2px 8px 6px",
                textTransform: "uppercase",
              }}
            >
              GLAVNI DESK
            </div>
          )}
          {renderNavList(mainDeskItems)}
        </div>

        {/* =========================================================
            2. FINANSIJE (OPERATIVA) — SKLOPIVO
            ========================================================= */}
        <div
          style={{
            background: "#141820",
            border: "1px solid #262d3b",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {renderSectionHeader("Finansije", "finance", financeItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.finance : true) && (
            <div style={{ paddingTop: collapsed ? 0 : 4 }}>{renderNavList(financeItems, true)}</div>
          )}
        </div>

        {/* =========================================================
            3. PROFIT & ANALITIKA — SKLOPIVO
            ========================================================= */}
        <div
          style={{
            background: "#141820",
            border: "1px solid #262d3b",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {renderSectionHeader("Profit & Analitika", "analytics", analyticsItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.analytics : true) && (
            <div style={{ paddingTop: collapsed ? 0 : 4 }}>{renderNavList(analyticsItems, true)}</div>
          )}
        </div>

        {/* =========================================================
            4. ŠIFARNICI — SKLOPIVO
            ========================================================= */}
        <div
          style={{
            background: "#141820",
            border: "1px solid #262d3b",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {renderSectionHeader("Šifarnici", "sifarnici", sifarniciItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.sifarnici : true) && (
            <div style={{ paddingTop: collapsed ? 0 : 4 }}>{renderNavList(sifarniciItems, true)}</div>
          )}
        </div>

        {/* =========================================================
            5. SISTEM & PRAVA — SKLOPIVO
            ========================================================= */}
        <div
          style={{
            background: "#141820",
            border: "1px solid #262d3b",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {renderSectionHeader("Sistem", "system", systemItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.system : true) && (
            <div style={{ paddingTop: collapsed ? 0 : 4 }}>{renderNavList(systemItems, true)}</div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: "9px 10px",
          borderTop: "1px solid #262d3b",
          background: "#1b2029",
          fontSize: 11,
          color: "#64748b",
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: "0.4px",
        }}
      >
        {collapsed ? "v2.6" : `v. ${FLUXA_VERSION}`}
      </div>
    </aside>
  );
}
