"use client";

import React, { useState } from "react";
import {
  LOGISTIX_BASE_PACKAGES,
  LOGISTIX_MODULE_KEYS,
  getLogistixBasePackage,
  type LogistixBasePackageId,
} from "@/lib/logistix-activation";

interface TenantRowLike {
  tenant_id: number;
  naziv: string;
  soccs_tier?: string | null;
  soccs_platform_scope?: string | null;
  status: string;
}

interface LogistiXModulesModalProps {
  row: TenantRowLike;
  onClose: () => void;
  onSaved: () => void;
}

export default function LogistiXModulesModal({
  row,
  onClose,
  onSaved,
}: LogistiXModulesModalProps) {
  const currentPkgId = (row.soccs_tier as LogistixBasePackageId) || "LOGISTIX_FLEET_MONTHLY";
  const [selectedPkg, setSelectedPkg] = useState<LogistixBasePackageId>(currentPkgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialScope = String(row.soccs_platform_scope ?? "").trim();
  const initialActive = initialScope ? initialScope.split(",").map((s) => s.trim()) : [];
  const hasFilter = initialActive.length > 0;

  const [modulesDraft, setModulesDraft] = useState<Record<string, boolean>>(() => {
    const draft: Record<string, boolean> = {};
    for (const m of LOGISTIX_MODULE_KEYS) {
      draft[m.key] = hasFilter ? initialActive.includes(m.key) : true;
    }
    return draft;
  });

  const toggleModule = (key: string) => {
    const mod = LOGISTIX_MODULE_KEYS.find((m) => m.key === key);
    if (mod?.isCore) return;
    setModulesDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const activeKeys = LOGISTIX_MODULE_KEYS.filter((m) => modulesDraft[m.key]).map((m) => m.key);
      const scopeStr = activeKeys.join(",");
      const pkg = getLogistixBasePackage(selectedPkg);

      const res = await fetch(`/api/tenant-admin/tenants/${row.tenant_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soccs_tier: selectedPkg,
          soccs_platform_scope: scopeStr,
          monthly_price: pkg.priceEur,
        }),
      });

      if (!res.ok) {
        throw new Error("Greška pri snimanju modula za LogistiX tenanta.");
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Greška pri čuvanju.");
    } finally {
      setSaving(false);
    }
  };

  const pkg = getLogistixBasePackage(selectedPkg);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#161c24",
          border: "1px solid #334155",
          borderRadius: 14,
          width: "100%",
          maxWidth: 620,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
          color: "#f8fafc",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-y", alignItems: "center", borderBottom: "1px solid #2d3748", paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>
              🚛 LogistiX Licencni Paket & Moduli
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#94a3b8" }}>
              Prevoznik: <strong>{row.naziv}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
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
          <div style={{ background: "rgba(239,68,68,0.2)", border: "1px solid #ef4444", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Paket Selector */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#cbd5e1" }}>
            Odaberite Osnovni LogistiX Paket:
          </label>
          <select
            value={selectedPkg}
            onChange={(e) => setSelectedPkg(e.target.value as any)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {LOGISTIX_BASE_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.priceEur} EUR / {p.priceKm} KM) — Kapacitet: do {p.maxTrucks} šlepera
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0 0" }}>
            {pkg.description}
          </p>
        </div>

        {/* Modules List */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#cbd5e1" }}>
            Aktivni Moduli za ovog Prevoznika:
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {LOGISTIX_MODULE_KEYS.map((m) => {
              const active = !!modulesDraft[m.key];
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
                    background: active ? "rgba(245, 158, 11, 0.12)" : "rgba(30, 41, 59, 0.5)",
                    border: active ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid #334155",
                    cursor: m.isCore ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? "#fff" : "#94a3b8" }}>
                        {m.label} {m.isCore && <span style={{ fontSize: 10, color: "#f59e0b" }}>(Osnovno jezgro)</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{m.shortDesc}</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={m.isCore}
                    readOnly
                    style={{ cursor: "pointer" }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #2d3748", paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#cbd5e1",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Odustani
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{
              padding: "7px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #d97706, #b45309)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Snimanje..." : "Sačuvaj Promjene"}
          </button>
        </div>
      </div>
    </div>
  );
}
