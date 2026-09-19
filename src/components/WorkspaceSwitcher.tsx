"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type WorkspaceMode = "STUDIO" | "ENTERSYS" | "LICENCE";

const STORAGE_KEY_WORKSPACE = "fluxa_workspace_mode";

export function getStoredWorkspace(): WorkspaceMode {
  if (typeof window === "undefined") return "STUDIO";
  const v = window.localStorage.getItem(STORAGE_KEY_WORKSPACE);
  if (v === "ENTERSYS" || v === "LICENCE" || v === "STUDIO") return v;
  return "STUDIO";
}

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const [mode, setMode] = useState<WorkspaceMode>("STUDIO");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(getStoredWorkspace());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (newMode: WorkspaceMode) => {
    setMode(newMode);
    setOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_WORKSPACE, newMode);
      window.dispatchEvent(new Event("workspace-changed"));
    }
    if (newMode === "LICENCE") {
      router.push("/studio/licence");
    } else if (newMode === "ENTERSYS") {
      router.push("/ops/magacini");
    } else {
      router.push("/dashboard");
    }
  };

  const getBadgeInfo = (m: WorkspaceMode) => {
    switch (m) {
      case "ENTERSYS":
        return {
          label: "🏭 EnterSYS HaaS",
          bg: "rgba(245, 158, 11, 0.15)",
          border: "rgba(245, 158, 11, 0.4)",
          color: "#fbbf24",
        };
      case "LICENCE":
        return {
          label: "🔐 Licencni Hub",
          bg: "rgba(168, 85, 247, 0.15)",
          border: "rgba(168, 85, 247, 0.4)",
          color: "#c084fc",
        };
      case "STUDIO":
      default:
        return {
          label: "🎨 Studio TAF",
          bg: "rgba(56, 189, 248, 0.15)",
          border: "rgba(56, 189, 248, 0.4)",
          color: "#38bdf8",
        };
    }
  };

  const currentBadge = getBadgeInfo(mode);

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: currentBadge.bg,
          borderColor: currentBadge.border,
          color: currentBadge.color,
          fontWeight: 700,
          fontSize: 13,
          padding: "6px 12px",
        }}
        title="Promjena radnog prostora (Studio TAF / EnterSYS HaaS / Licence)"
      >
        <span>{currentBadge.label}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--panel, #18181b)",
            border: "1px solid var(--border, #27272a)",
            borderRadius: 12,
            boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            zIndex: 9999,
            minWidth: 230,
            padding: 6,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              padding: "6px 10px 8px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--muted, #a1a1aa)",
              borderBottom: "1px solid var(--border, #27272a)",
              marginBottom: 4,
            }}
          >
            Odaberi radni prostor
          </div>

          <button
            type="button"
            onClick={() => handleSelect("STUDIO")}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              padding: "8px 10px",
              textAlign: "left",
              background: mode === "STUDIO" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              border: "none",
              borderRadius: 8,
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span style={{ fontWeight: 700, color: "#38bdf8", fontSize: 13 }}>🎨 Studio TAF</span>
            <span style={{ fontSize: 11, color: "var(--muted, #a1a1aa)" }}>
              Audio produkcija, software dev, plivačka takmičenja & finansije
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("ENTERSYS")}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              padding: "8px 10px",
              textAlign: "left",
              background: mode === "ENTERSYS" ? "rgba(245, 158, 11, 0.15)" : "transparent",
              border: "none",
              borderRadius: 8,
              color: "inherit",
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            <span style={{ fontWeight: 700, color: "#fbbf24", fontSize: 13 }}>🏭 EnterSYS HaaS & Ops</span>
            <span style={{ fontSize: 11, color: "var(--muted, #a1a1aa)" }}>
              Magacini, kompletacija uređaja, radni nalozi & servisi
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("LICENCE")}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              padding: "8px 10px",
              textAlign: "left",
              background: mode === "LICENCE" ? "rgba(168, 85, 247, 0.15)" : "transparent",
              border: "none",
              borderRadius: 8,
              color: "inherit",
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            <span style={{ fontWeight: 700, color: "#c084fc", fontSize: 13 }}>🔐 Master Licencni Hub</span>
            <span style={{ fontSize: 11, color: "var(--muted, #a1a1aa)" }}>
              Izdavanje i nadzor licenci za sve eksterne klijente
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
