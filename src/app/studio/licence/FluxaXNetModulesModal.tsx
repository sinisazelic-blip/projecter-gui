"use client";

import React, { useState } from "react";
import {
  FLUXAX_NET_BASE_PACKAGES,
  FLUXAX_NET_MODULE_KEYS,
  getFluxaXNetBasePackage,
  type FluxaXNetBasePackageId,
} from "@/lib/fluxaxnet-activation";

interface TenantRowLike {
  tenant_id: number;
  naziv: string;
  soccs_tier?: string | null;
  soccs_platform_scope?: string | null;
  status: string;
}

interface FluxaXNetModulesModalProps {
  row: TenantRowLike;
  onClose: () => void;
  onSaved: () => void;
}

export default function FluxaXNetModulesModal({
  row,
  onClose,
  onSaved,
}: FluxaXNetModulesModalProps) {
  const currentPkgId = (row.soccs_tier as FluxaXNetBasePackageId) || "FLUXAX_STUDIO_MONTHLY";
  const [selectedPkg, setSelectedPkg] = useState<FluxaXNetBasePackageId>(currentPkgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialScope = String(row.soccs_platform_scope ?? "").trim();
  const initialActive = initialScope ? initialScope.split(",").map((s) => s.trim()) : [];
  const hasFilter = initialActive.length > 0;

  const [modulesDraft, setModulesDraft] = useState<Record<string, boolean>>(() => {
    const draft: Record<string, boolean> = {};
    for (const m of FLUXAX_NET_MODULE_KEYS) {
      draft[m.key] = hasFilter ? initialActive.includes(m.key) : true;
    }
    return draft;
  });

  const toggleModule = (key: string) => {
    const mod = FLUXAX_NET_MODULE_KEYS.find((m) => m.key === key);
    if (mod?.isCore) return; // Core modules cannot be disabled
    setModulesDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const activeKeys = FLUXAX_NET_MODULE_KEYS.filter((m) => modulesDraft[m.key]).map((m) => m.key);
      const scopeStr = activeKeys.join(",");
      const pkg = getFluxaXNetBasePackage(selectedPkg);

      const res = await fetch(`/api/tenant-admin/tenants/${row.tenant_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soccs_tier: selectedPkg,
          soccs_platform_scope: scopeStr,
          monthly_price: pkg.priceEur,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        onSaved();
      } else {
        setError(data.error || "Greška pri čuvanju paketa i modula.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pkg = getFluxaXNetBasePackage(selectedPkg);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => !saving && onClose()}
    >
      <div
        style={{
          backgroundColor: "#0e131d",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          borderRadius: 16,
          maxWidth: 640,
          width: "100%",
          padding: 24,
          color: "#f8fafc",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>
              🎛️ FluxaX NET — Paket & Moduli Studija
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#94a3b8" }}>
              Tenant: <strong style={{ color: "#fff" }}>{row.naziv}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.2)", border: "1px solid #ef4444", borderRadius: 8, color: "#fca5a5", fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Package Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
            Osnovni FluxaX Paket & Trajanje:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {FLUXAX_NET_BASE_PACKAGES.map((p) => {
              const active = selectedPkg === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPkg(p.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: active ? "2px solid #38bdf8" : "1px solid rgba(148, 163, 184, 0.2)",
                    backgroundColor: active ? "rgba(56, 189, 248, 0.12)" : "rgba(15, 23, 42, 0.5)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: active ? "#38bdf8" : "#e2e8f0" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0" }}>
                    {p.durationDays} dana • do {p.maxInOutputs} I/O
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>
                    {p.priceEur} EUR ({p.priceKm} KM)
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
            {pkg.description}
          </div>
        </div>

        {/* Modules List */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
            Dozvoljeni Moduli i Servisi:
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FLUXAX_NET_MODULE_KEYS.map((m) => {
              const checked = Boolean(modulesDraft[m.key]);
              return (
                <div
                  key={m.key}
                  onClick={() => toggleModule(m.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(148, 163, 184, 0.15)",
                    cursor: m.isCore ? "default" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc" }}>
                        {m.label} {m.isCore && <span style={{ fontSize: 10, color: "#38bdf8", marginLeft: 6 }}>[OBARATNO JEZGRO]</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {m.shortDesc}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={m.isCore}
                    onChange={() => toggleModule(m.key)}
                    style={{ width: 18, height: 18, accentColor: "#38bdf8", cursor: m.isCore ? "default" : "pointer" }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid rgba(148, 163, 184, 0.2)", paddingTop: 16 }}>
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={onClose}
            style={{ padding: "8px 16px" }}
          >
            Otkaži
          </button>
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={handleSave}
            style={{
              padding: "8px 20px",
              background: "#38bdf8",
              color: "#0f172a",
              fontWeight: 700,
              border: "none",
            }}
          >
            {saving ? "Čuvanje..." : "Sačuvaj Podešavanja"}
          </button>
        </div>
      </div>
    </div>
  );
}
