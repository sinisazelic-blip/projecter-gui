"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users2,
  Building2,
  Briefcase,
  UserCheck,
  ShieldCheck,
  Settings,
  KeyRound,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Database
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { useAuthUser } from "@/components/AuthUserProvider";

export default function MasterSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { canSee, nivo, user } = useAuthUser();
  const [collapsed, setCollapsed] = useState(false);
  const isOwner = user?.user_id === 0 || user?.username === "Owner" || (nivo ?? 0) >= 8;

  const navItems = [
    {
      title: "ŠIFARNICI & BAZA",
      items: [
        { label: "Klijenti", href: "/studio/klijenti", icon: Users2, show: true },
        { label: "Dobavljači", href: "/studio/dobavljaci", icon: Briefcase, show: true },
        { label: "Radnici & Ekipa", href: "/studio/radnici", icon: UserCheck, show: true },
        { label: "Podešavanja Firme", href: "/studio/firma", icon: Building2, show: true },
      ],
    },
    {
      title: "SISTEM & LICENCE",
      items: [
        { label: "Korisnici", href: "/studio/users", icon: Settings, show: isOwner || canSee("Šifarnici - Users", "") },
        { label: "Uloge i Prava", href: "/studio/roles", icon: ShieldCheck, show: isOwner || canSee("Šifarnici - Roles", "") },
        { label: "Master Hub Licenci", href: "/studio/licence", icon: KeyRound, show: isOwner },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
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
      {/* Sidebar Header */}
      <div
        style={{
          padding: "16px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={16} color="var(--accent, #7dd3fc)" />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.5px", color: "var(--muted, #a9b4c2)" }}>
              ŠIFARNICI & SISTEM
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
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title={collapsed ? "Proširi meni" : "Skupi meni"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {navItems.map((group, gIdx) => (
          <div key={gIdx} style={{ marginBottom: 18 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.8px",
                  color: "rgba(255, 255, 255, 0.35)",
                  padding: "4px 8px 6px",
                  textTransform: "uppercase",
                }}
              >
                {group.title}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {group.items
                .filter((it) => it.show)
                .map((it, idx) => {
                  const Icon = it.icon;
                  const active = pathname === it.href;
                  const isLicence = it.href === "/studio/licence";
                  return (
                    <Link
                      key={idx}
                      href={it.href}
                      title={collapsed ? it.label : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: collapsed ? "10px 0" : "8px 10px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: isLicence ? 800 : (active ? 700 : 500),
                        color: active ? "#ffffff" : isLicence ? "#38bdf8" : "var(--muted, #a9b4c2)",
                        background: active
                          ? "rgba(125, 211, 252, 0.15)"
                          : isLicence
                            ? "rgba(56, 189, 248, 0.08)"
                            : "transparent",
                        border: active
                          ? "1px solid rgba(125, 211, 252, 0.3)"
                          : isLicence
                            ? "1px solid rgba(56, 189, 248, 0.25)"
                            : "1px solid transparent",
                        textDecoration: "none",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = isLicence ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.04)";
                          e.currentTarget.style.color = isLicence ? "#7dd3fc" : "var(--text, #e8eef6)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = isLicence ? "rgba(56, 189, 248, 0.08)" : "transparent";
                          e.currentTarget.style.color = isLicence ? "#38bdf8" : "var(--muted, #a9b4c2)";
                        }
                      }}
                    >
                      <Icon size={16} strokeWidth={isLicence || active ? 2.2 : 1.8} color={isLicence && !active ? "#38bdf8" : undefined} />
                      {!collapsed && <span>{it.label}</span>}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.3)",
          textAlign: "center",
        }}
      >
        {collapsed ? "v2.6" : "Fluxa Master v2.6"}
      </div>
    </aside>
  );
}
