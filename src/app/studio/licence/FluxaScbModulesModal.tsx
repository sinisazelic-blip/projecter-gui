"use client";

import React, { useState } from "react";
import {
  FLUXASCB_BASE_PACKAGES,
  FLUXASCB_MODULE_KEYS,
  defaultModulesForFluxaScbPackage,
  getFluxaScbBasePackage,
  type FluxaScbBasePackageId,
} from "@/lib/fluxascb-activation";

interface TenantRowLike {
  tenant_id: number;
  naziv: string;
  soccs_tier?: string | null;
  soccs_platform_scope?: string | null;
  status: string;
}

interface FluxaScbModulesModalProps {
  row: TenantRowLike;
  onClose: () => void;
  onSaved: () => void;
}

export default function FluxaScbModulesModal({
  row,
  onClose,
  onSaved,
}: FluxaScbModulesModalProps) {
  const currentPkgId = (row.soccs_tier as FluxaScbBasePackageId) || "FLUXASCB_CORE_MONTHLY";
  const [selectedPkg, setSelectedPkg] = useState<FluxaScbBasePackageId>(currentPkgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialScope = String(row.soccs_platform_scope ?? "").trim();
  const initialActive = initialScope ? initialScope.split(",").map((s) => s.trim()) : [];
  const hasFilter = initialActive.length > 0;

  const [modulesDraft, setModulesDraft] = useState<Record<string, boolean>>(() => {
    const def = defaultModulesForFluxaScbPackage(currentPkgId);
    const draft: Record<string, boolean> = {};
    for (const m of FLUXASCB_MODULE_KEYS) {
      draft[m.key] = hasFilter ? initialActive.includes(m.key) : Boolean(def[m.key]);
    }
    return draft;
  });

  const handlePackageChange = (nextPkg: FluxaScbBasePackageId) => {
    setSelectedPkg(nextPkg);
    setModulesDraft(defaultModulesForFluxaScbPackage(nextPkg));
  };

  const toggleModule = (key: string) => {
    const mod = FLUXASCB_MODULE_KEYS.find((m) => m.key === key);
    if (mod?.isCore) return;
    setModulesDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const activeKeys = FLUXASCB_MODULE_KEYS.filter((m) => modulesDraft[m.key]).map((m) => m.key);
      const scopeStr = activeKeys.join(",");
      const pkg = getFluxaScbBasePackage(selectedPkg);

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
        throw new Error("Greška pri snimanju paketa i modula za FluxaSCB tenanta.");
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || "Greška pri čuvanju.");
    } finally {
      setSaving(false);
    }
  };

  const pkg = getFluxaScbBasePackage(selectedPkg);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 20,
          width: "100%",
          maxWidth: 520,
          color: "#f8fafc",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700 }}>
          🏊 FluxaSCB — Paket &amp; Moduli ({row.naziv})
        </h3>
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#94a3b8" }}>
          Promjena paketa odmah ažurira prava za isti licencni token.
        </p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          Odaberi paket &amp; model naplate:
        </label>
        <select
          value={selectedPkg}
          onChange={(e) => handlePackageChange(e.target.value as FluxaScbBasePackageId)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            background: "#1e293b",
            border: "1px solid #475569",
            color: "#f8fafc",
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {FLUXASCB_BASE_PACKAGES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.priceEur} EUR ({p.durationDays} dana)
            </option>
          ))}
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {FLUXASCB_MODULE_KEYS.map((m) => {
            const checked = Boolean(modulesDraft[m.key]);
            return (
              <label
                key={m.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: checked ? "rgba(56, 189, 248, 0.4)" : "#1e293b",
                  background: checked ? "rgba(56, 189, 248, 0.08)" : "rgba(15, 23, 42, 0.5)",
                  cursor: m.isCore ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={m.isCore}
                  onChange={() => toggleModule(m.key)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.shortDesc}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          Cijena paketa: <strong style={{ color: "#38bdf8" }}>{pkg.priceEur} EUR</strong> /{" "}
          {pkg.billingMode === "SINGLE_EVENT" ? "Jedan Event (7d)" : "Mjesečna pretplata"}
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Odustani
          </button>
          <button type="button" className="btn btn-sm primary" onClick={handleSave} disabled={saving}>
            {saving ? "Čuvam..." : "Sačuvaj Paket & Module"}
          </button>
        </div>
      </div>
    </div>
  );
}
