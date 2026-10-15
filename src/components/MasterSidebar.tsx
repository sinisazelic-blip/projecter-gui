"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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

  const renderNavList = (items: any[]) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items
          .filter((it) => it.show)
          .map((it, idx) => {
            const Icon = it.icon;
            const active = pathname === it.href;
            const itemColor = it.color || (active ? "#7dd3fc" : "var(--muted, #a9b4c2)");
            return (
              <Link
                key={idx}
                href={it.href}
                title={collapsed ? it.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: collapsed ? "9px 0" : "8px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 9,
                  fontSize: 14.5,
                  fontWeight: active ? 800 : it.isSpecial ? 700 : 500,
                  color: active ? "#ffffff" : it.isSpecial ? "#38bdf8" : "var(--muted, #a9b4c2)",
                  background: active
                    ? "rgba(56, 189, 248, 0.16)"
                    : it.isSpecial
                      ? "rgba(56, 189, 248, 0.08)"
                      : "transparent",
                  border: active
                    ? "1px solid rgba(56, 189, 248, 0.35)"
                    : it.isSpecial
                      ? "1px solid rgba(56, 189, 248, 0.22)"
                      : "1px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = it.isSpecial ? "rgba(56, 189, 248, 0.08)" : "transparent";
                    e.currentTarget.style.color = it.isSpecial ? "#38bdf8" : "var(--muted, #a9b4c2)";
                  }
                }}
              >
                <Icon size={17} strokeWidth={active || it.isSpecial ? 2.2 : 1.8} color={itemColor} />
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
            margin: "10px 4px",
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
          padding: "6px 8px",
          marginBottom: 4,
          background: "none",
          border: "none",
          color: "rgba(255, 255, 255, 0.45)",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          borderRadius: 6,
          transition: "background 0.1s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>{title}</span>
          <span style={{ fontSize: 9, opacity: 0.7 }}>({count})</span>
        </div>
        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
    );
  };

  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "#0c121b",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
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
          padding: "14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.4px", color: "#ffffff" }}>
              Studio TAF
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--text, #e8eef6)",
            borderRadius: 8,
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
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
        {/* =========================================================
            1. GLAVNI DESK (UVIJEK VIDLJIV, NE SKLAPA SE)
            ========================================================= */}
        <div style={{ marginBottom: 14 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.8px",
                color: "#38bdf8",
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
        <div style={{ marginBottom: 12 }}>
          {renderSectionHeader("FINANSIJE OPERATIVA", "finance", financeItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.finance : true) && renderNavList(financeItems)}
        </div>

        {/* =========================================================
            3. PROFIT & ANALITIKA — SKLOPIVO
            ========================================================= */}
        <div style={{ marginBottom: 12 }}>
          {renderSectionHeader("PROFIT & ANALITIKA", "analytics", analyticsItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.analytics : true) && renderNavList(analyticsItems)}
        </div>

        {/* =========================================================
            4. ŠIFARNICI — SKLOPIVO
            ========================================================= */}
        <div style={{ marginBottom: 12 }}>
          {renderSectionHeader("ŠIFARNICI", "sifarnici", sifarniciItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.sifarnici : true) && renderNavList(sifarniciItems)}
        </div>

        {/* =========================================================
            5. SISTEM & PRAVA — SKLOPIVO
            ========================================================= */}
        <div style={{ marginBottom: 12 }}>
          {renderSectionHeader("SISTEM", "system", systemItems.filter(i => i.show).length)}
          {(!collapsed ? openSections.system : true) && renderNavList(systemItems)}
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: "10px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.35)",
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: "0.4px",
        }}
      >
        {collapsed ? "v2.6" : "v. 2.6.16"}
      </div>
    </aside>
  );
}
