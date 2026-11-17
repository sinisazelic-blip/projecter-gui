// src/app/studio/licence/ModernTenantBillingView.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateProRata,
  getTenantBillingInfo,
  BILLING_CONTACT_EMAIL,
  PAYMENT_ACKNOWLEDGEMENT_NOTE,
  type TenantBillingInfo,
} from "@/lib/tenant-billing";

interface ModernTenantBillingViewProps {
  tenants: any[];
  klijenti: any[];
  plans: any[];
  onSwitchToClassic: () => void;
  onRefresh: () => void;
  onOpenNewTenant: () => void;
  onOpenToken?: (tenant: any) => void;
  onOpenModules?: (tenant: any) => void;
  onOpenContact?: (tenant: any) => void;
  onOpenExtend?: (tenant: any) => void;
  onToggleStatus?: (tenantId: number, newStatus: string, tenant: any) => void;
  statusSavingId?: number | null;
}

function parseScopeModules(scope: string | null | undefined): string[] {
  if (!scope) return [];
  const s = String(scope).trim();
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (typeof parsed === "object" && parsed !== null) {
        return Object.keys(parsed).filter((k) => Boolean(parsed[k]));
      }
    } catch {}
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default function ModernTenantBillingView({
  tenants,
  klijenti,
  plans,
  onSwitchToClassic,
  onRefresh,
  onOpenNewTenant,
  onOpenToken,
  onOpenModules,
  onOpenContact,
  onOpenExtend,
  onToggleStatus,
  statusSavingId,
}: ModernTenantBillingViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [productFilter, setProductFilter] = useState<string>("ALL");

  // Prošireni red sa detaljima ugovora i modula
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Pro-rata modal state
  const [proRataOpen, setProRataOpen] = useState(false);
  const [proRataPrice, setProRataPrice] = useState<number>(100);
  const [proRataCurrency, setProRataCurrency] = useState("KM");
  const [proRataDate, setProRataDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  // Invoice specification modal state
  const [invoiceModalTenant, setInvoiceModalTenant] = useState<any | null>(null);

  // Quick extension loading state
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);

  // Izračunaj Pro-rata rezultat
  const proRataResult = useMemo(() => {
    return calculateProRata(proRataPrice, proRataDate);
  }, [proRataPrice, proRataDate]);

  // Mapiraj klijente po ID-u
  const klijentMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const k of klijenti ?? []) {
      map.set(Number(k.klijent_id), k);
    }
    return map;
  }, [klijenti]);

  // Obogaćeni tenanti sa billing podacima
  const enrichedTenants = useMemo(() => {
    return (tenants ?? []).map((t) => {
      const billing = getTenantBillingInfo(t);
      const kl = t.klijent_id ? klijentMap.get(Number(t.klijent_id)) : null;
      return {
        ...t,
        billing,
        klijent_naziv: kl?.naziv_klijenta || t.naziv,
        klijent_jib: kl?.jib || kl?.porezni_id || null,
        klijent_adresa: kl?.adresa || kl?.grad || null,
        klijent_is_ino: Boolean(kl?.is_ino),
      };
    });
  }, [tenants, klijentMap]);

  // KPI metrike
  const metrics = useMemo(() => {
    let activeCount = 0;
    let graceCount = 0;
    let suspendedCount = 0;
    let mrrKm = 0;
    let mrrEur = 0;

    for (const t of enrichedTenants) {
      const price = Number(t.monthly_price) || 0;
      const ccy = (t.currency || "KM").toUpperCase();

      if (t.billing.statusType === "PAID" || t.billing.statusType === "PILOT") {
        activeCount++;
      }
      if (t.billing.statusType === "GRACE_PERIOD") {
        activeCount++;
        graceCount++;
      }
      if (t.billing.statusType === "SUSPENDOVAN") {
        suspendedCount++;
      }

      if (t.billing.statusType !== "SUSPENDOVAN") {
        if (ccy === "EUR" || ccy === "€") {
          mrrEur += price;
        } else {
          mrrKm += price;
        }
      }
    }

    return {
      activeCount,
      graceCount,
      suspendedCount,
      mrrKm: mrrKm.toFixed(2),
      mrrEur: mrrEur.toFixed(2),
    };
  }, [enrichedTenants]);

  // Filtrirani tenanti
  const filteredTenants = useMemo(() => {
    return enrichedTenants.filter((t) => {
      // 1. Text filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (t.naziv || "").toLowerCase().includes(q);
        const matchesClient = (t.klijent_naziv || "").toLowerCase().includes(q);
        const matchesEmail = (t.billing_email || "").toLowerCase().includes(q);
        const matchesToken = (t.licence_token || "").toLowerCase().includes(q);
        const matchesId = String(t.tenant_id).includes(q);
        if (!matchesName && !matchesClient && !matchesEmail && !matchesToken && !matchesId) return false;
      }

      // 2. Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && t.billing.statusType !== "PAID" && t.billing.statusType !== "PILOT") return false;
        if (statusFilter === "GRACE" && t.billing.statusType !== "GRACE_PERIOD") return false;
        if (statusFilter === "SUSPENDED" && t.billing.statusType !== "SUSPENDOVAN") return false;
      }

      // 3. Product filter
      if (productFilter !== "ALL") {
        const prod = (t.studio_licence_profile || "").toUpperCase();
        if (productFilter === "ENTERSYS" && !prod.includes("ENTERSYS")) return false;
        if (productFilter === "FLUXAPOS" && !prod.includes("FLUXAPOS")) return false;
        if (productFilter === "DOCENTRE" && !prod.includes("JAVNENABAVKE") && !prod.includes("DOCENTRE")) return false;
        if (productFilter === "SOCCS" && !prod.includes("SOCCS")) return false;
        if (productFilter === "FLUXAX" && !prod.includes("FLUXAX")) return false;
        if (productFilter === "LOGISTIX" && !prod.includes("LOGISTIX")) return false;
      }

      return true;
    });
  }, [enrichedTenants, searchTerm, statusFilter, productFilter]);

  // Akcija brzog produženja (+48h)
  const handleGraceExtend = async (tenantId: number) => {
    try {
      setExtendingId(tenantId);
      setActionFeedback(null);
      const res = await fetch("/api/tenant-admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grace-extend",
          tenant_id: tenantId,
          hours: 48,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Greška pri produženju");

      setActionFeedback(`Uspješno produžen grace period za 48h (Novi rok: ${data.new_ends_at}).`);
      onRefresh();
    } catch (err: any) {
      alert("Greška: " + err.message);
    } finally {
      setExtendingId(null);
    }
  };

  // Kopiranje u clipboard
  const handleCopy = (text: string, id: number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* 1. HEADER I AKCIJE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 850, color: "#ffffff", letterSpacing: "-0.02em" }}>
            SaaS Billing & Tenant Centar
          </h2>
          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.55)", marginTop: 4 }}>
            Hetzner model obračuna (1. u mjesecu) · Grace period do 14 dana · Upravljanje ugovorima i blokada zloupotrebe
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setProRataOpen(true)}
            style={{
              fontWeight: 700,
              background: "rgba(56, 189, 248, 0.12)",
              borderColor: "rgba(56, 189, 248, 0.35)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⚡ Pro-Rata Kalkulator
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewTenant}
            style={{ fontWeight: 750 }}
          >
            + Novi Tenant
          </button>

          <button
            type="button"
            className="btn"
            onClick={onSwitchToClassic}
            title="Prebaci na stari tabularni prikaz sa profilima licenci"
            style={{ fontWeight: 650, color: "rgba(255, 255, 255, 0.8)" }}
          >
            ⇄ Klasični Prikaz
          </button>
        </div>
      </div>

      {/* FEEDBACK NOTIFIKACIJA */}
      {actionFeedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            color: "#6ee7b7",
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {actionFeedback}</span>
          <button
            onClick={() => setActionFeedback(null)}
            style={{ background: "none", border: "none", color: "#6ee7b7", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. KPI METRIC CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          width: "100%",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Aktivni Tenanti
          </div>
          <div style={{ fontSize: 26, fontWeight: 850, color: "#ffffff", marginTop: 4 }}>
            {metrics.activeCount}
          </div>
          <div style={{ fontSize: 12, color: "#10b981", marginTop: 2 }}>
            Aktivne pretplate
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Mjesečni Zakup (BAM)
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: "#38bdf8", marginTop: 4 }}>
            {metrics.mrrKm} KM
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 2 }}>
            Domaće ugovorene licence
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Mjesečni Zakup (EUR)
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: "#a855f7", marginTop: 4 }}>
            {metrics.mrrEur} €
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 2 }}>
            INO licence (0% PDV, stopa K)
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            background: metrics.graceCount > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.03)",
            border: metrics.graceCount > 0 ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: metrics.graceCount > 0 ? "#fbbf24" : "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Grace Period (Čeka Izvod)
          </div>
          <div style={{ fontSize: 26, fontWeight: 850, color: metrics.graceCount > 0 ? "#f59e0b" : "#ffffff", marginTop: 4 }}>
            {metrics.graceCount}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 2 }}>
            Tolerancija do 14. u mjesecu
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            background: metrics.suspendedCount > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.03)",
            border: metrics.suspendedCount > 0 ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: metrics.suspendedCount > 0 ? "#fca5a5" : "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Soft Suspenzija / Blokirano
          </div>
          <div style={{ fontSize: 26, fontWeight: 850, color: metrics.suspendedCount > 0 ? "#ef4444" : "#ffffff", marginTop: 4 }}>
            {metrics.suspendedCount}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 2 }}>
            Prekoračen rok / Blokiran rad
          </div>
        </div>
      </div>

      {/* 3. FILTERI I PRETRAGA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: "1 1 320px", maxWidth: 460 }}>
          <input
            className="input"
            type="text"
            placeholder="Pretraži tenante po nazivu, klijentu, tokenu, emailu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="ALL">Svi statusi</option>
            <option value="ACTIVE">Aktivno / Plaćeno</option>
            <option value="GRACE">U Grace periodu</option>
            <option value="SUSPENDED">Suspendovano / Blokirano</option>
          </select>

          <select
            className="input"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="ALL">Svi proizvodi</option>
            <option value="ENTERSYS">EnterSYS</option>
            <option value="FLUXAPOS">FluxaPOS</option>
            <option value="DOCENTRE">DokumentArt (JN)</option>
            <option value="SOCCS">SOCCS SwimVoice</option>
            <option value="FLUXAX">FluxaX NET</option>
            <option value="LOGISTIX">LogistiX</option>
          </select>
        </div>
      </div>

      {/* 4. MODERNA TABELA TENANATA SA DINAMIČKOM ŠIRINOM */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          overflow: "visible",
          width: "100%",
        }}
      >
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0, tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ width: 45, textAlign: "center" }}>#ID</th>
                <th style={{ minWidth: 190 }}>Tenant & Pravno Lice</th>
                <th style={{ minWidth: 150 }}>Proizvod & Paket</th>
                <th style={{ minWidth: 140 }}>Licence Token</th>
                <th style={{ minWidth: 120 }}>Ugovoreni Zakup</th>
                <th style={{ minWidth: 105 }}>Plaćeno Do</th>
                <th style={{ minWidth: 120 }}>Status Licence</th>
                <th style={{ minWidth: 320, textAlign: "right" }}>Upravljanje & Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "rgba(255, 255, 255, 0.4)" }}>
                    Nema tenanata koji odgovaraju izabranim filterima.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const b = t.billing as TenantBillingInfo;
                  const price = Number(t.monthly_price) || 0;
                  const ccy = t.currency || "KM";
                  const isExpanded = expandedRowId === t.tenant_id;
                  const isSuspended = String(t.status).toUpperCase() === "SUSPENDOVAN";
                  const modules = parseScopeModules(t.soccs_platform_scope);

                  return (
                    <React.Fragment key={t.tenant_id}>
                      <tr
                        style={{
                          background: isExpanded ? "rgba(56, 189, 248, 0.04)" : undefined,
                          transition: "background 0.2s",
                        }}
                      >
                        <td style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700 }}>
                          {t.tenant_id}
                        </td>

                        {/* TENANT I PRAVNO LICE */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 800, color: "#ffffff", fontSize: 14 }}>
                              {t.naziv}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : t.tenant_id)}
                              style={{
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                borderRadius: 6,
                                padding: "2px 6px",
                                fontSize: 10.5,
                                color: isExpanded ? "#38bdf8" : "rgba(255, 255, 255, 0.6)",
                                cursor: "pointer",
                              }}
                              title="Prikaži / Sakrij detalje ugovora, module i tokene"
                            >
                              {isExpanded ? "▲ Detalji" : "▼ Detalji"}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
                            {t.klijent_naziv}
                            {t.klijent_jib ? ` · JIB: ${t.klijent_jib}` : ""}
                          </div>
                          {t.billing_email && (
                            <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>
                              ✉ {t.billing_email}
                            </div>
                          )}
                        </td>

                        {/* PROIZVOD I PAKET */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontWeight: 800,
                                color: "#e2e8f0",
                                fontSize: 12,
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                              }}
                            >
                              {t.studio_licence_profile || "FLUXA"}
                            </span>
                            {onOpenModules && (
                              <button
                                type="button"
                                onClick={() => onOpenModules(t)}
                                style={{
                                  background: "rgba(96, 165, 250, 0.1)",
                                  border: "1px solid rgba(96, 165, 250, 0.3)",
                                  color: "#60a5fa",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  borderRadius: 5,
                                  padding: "2px 6px",
                                  cursor: "pointer",
                                }}
                                title="Pregled i izmjena zakupljenih modula i krovnog paketa"
                              >
                                📦 Moduli
                              </button>
                            )}
                          </div>
                          {t.soccs_tier && (
                            <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.45)", marginTop: 3 }}>
                              Paket: {t.soccs_tier}
                            </div>
                          )}
                        </td>

                        {/* LICENCE TOKEN */}
                        <td>
                          {t.licence_token ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <code
                                style={{
                                  fontSize: 11,
                                  background: "rgba(0,0,0,0.3)",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  color: "#38bdf8",
                                  fontFamily: "monospace",
                                }}
                                title={t.licence_token}
                              >
                                {String(t.licence_token).slice(0, 10)}...
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopy(t.licence_token, t.tenant_id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: copyFeedback === t.tenant_id ? "#34d399" : "rgba(255, 255, 255, 0.5)",
                                }}
                                title="Kopiraj puni token"
                              >
                                {copyFeedback === t.tenant_id ? "✓" : "📋"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.3)" }}>— Nema tokena —</span>
                          )}
                        </td>

                        {/* UGOVORENI ZAKUP */}
                        <td>
                          <div style={{ fontWeight: 800, color: "#ffffff", fontSize: 13.5 }}>
                            {price.toFixed(2)} {ccy}
                          </div>
                          <div style={{ fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)" }}>
                            mjesečno
                          </div>
                        </td>

                        {/* PLAĆENO DO */}
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: b.isExpired ? "#fca5a5" : "#e2e8f0" }}>
                            {b.subscriptionEndsAtFormatted}
                          </div>
                          {onOpenExtend && (
                            <button
                              type="button"
                              onClick={() => onOpenExtend(t)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#60a5fa",
                                fontSize: 10.5,
                                cursor: "pointer",
                                padding: 0,
                                marginTop: 1,
                              }}
                              title="Ručno promijeni datum važenja licence"
                            >
                              Izmjeni rok ✎
                            </button>
                          )}
                        </td>

                        {/* STATUS */}
                        <td>
                          {b.statusType === "PAID" && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: 7,
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#34d399",
                                fontSize: 11,
                                fontWeight: 750,
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                              }}
                            >
                              ✓ AKTIVAN
                            </span>
                          )}
                          {b.statusType === "GRACE_PERIOD" && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: 7,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#fbbf24",
                                fontSize: 11,
                                fontWeight: 750,
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                              }}
                              title={`Grace period do 14. u mjesecu. Preostalo: ${b.graceDaysLeft} dana.`}
                            >
                              ⏳ GRACE ({b.graceDaysLeft}d)
                            </span>
                          )}
                          {b.statusType === "SUSPENDOVAN" && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: 7,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                                fontSize: 11,
                                fontWeight: 750,
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                              }}
                            >
                              🛑 BLOKIRAN
                            </span>
                          )}
                          {b.statusType === "PILOT" && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: 7,
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                                fontSize: 11,
                                fontWeight: 750,
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                              }}
                            >
                              PILOT / TEST
                            </span>
                          )}
                        </td>

                        {/* KOMPLETNE AKCIJE UPRAVLJANJA */}
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {/* 1. TOKEN MODAL (Prikaz, QR, Regeneracija) */}
                            {onOpenToken && (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => onOpenToken(t)}
                                title="Pregled punog tokena, QR koda i regeneracija novog tokena"
                                style={{
                                  padding: "4px 7px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "rgba(255, 255, 255, 0.05)",
                                  borderColor: "rgba(255, 255, 255, 0.15)",
                                  color: "#e2e8f0",
                                }}
                              >
                                🔑 Token
                              </button>
                            )}

                            {/* 2. MODULI I PAKET */}
                            {onOpenModules && (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => onOpenModules(t)}
                                title="Pregled i izmjena zakupljenih modula, limita i kase"
                                style={{
                                  padding: "4px 7px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "rgba(59, 130, 246, 0.12)",
                                  borderColor: "rgba(59, 130, 246, 0.35)",
                                  color: "#60a5fa",
                                }}
                              >
                                📦 Moduli
                              </button>
                            )}

                            {/* 3. BLOKIRAJ / AKTIVIRAJ RAD (Zloupotreba i kontrola) */}
                            {onToggleStatus && (
                              isSuspended ? (
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={statusSavingId === t.tenant_id}
                                  onClick={() => onToggleStatus(t.tenant_id, "AKTIVAN", t)}
                                  title="Aktiviraj rad tenanta i odblokiraj pristup terenskom softveru"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    fontWeight: 750,
                                    background: "rgba(16, 185, 129, 0.18)",
                                    borderColor: "rgba(16, 185, 129, 0.45)",
                                    color: "#34d399",
                                  }}
                                >
                                  {statusSavingId === t.tenant_id ? "..." : "✓ Odblokiraj"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={statusSavingId === t.tenant_id}
                                  onClick={() => onToggleStatus(t.tenant_id, "SUSPENDOVAN", t)}
                                  title="Blokiraj pristup i rad tenanta (u slučaju zloupotrebe ili neplaćanja)"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    fontWeight: 750,
                                    background: "rgba(239, 68, 68, 0.15)",
                                    borderColor: "rgba(239, 68, 68, 0.4)",
                                    color: "#f87171",
                                  }}
                                >
                                  {statusSavingId === t.tenant_id ? "..." : "⛔ Blokiraj"}
                                </button>
                              )
                            )}

                            {/* 4. UPRAVLJAJ UGOVOROM (CRM, Podaci, Note) */}
                            {onOpenContact && (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => onOpenContact(t)}
                                title="Upravljaj ugovorom, CRM klijentom, kontakt podacima i napomenama"
                                style={{
                                  padding: "4px 7px",
                                  fontSize: 11,
                                  fontWeight: 650,
                                  background: "rgba(255, 255, 255, 0.05)",
                                  borderColor: "rgba(255, 255, 255, 0.15)",
                                  color: "#cbd5e1",
                                }}
                              >
                                ⚙️ Ugovor
                              </button>
                            )}

                            {/* 5. GRACE +48H */}
                            <button
                              type="button"
                              className="btn"
                              disabled={extendingId === t.tenant_id}
                              onClick={() => handleGraceExtend(t.tenant_id)}
                              title="Produži licencu za +48h dok izvod ne legne kroz banku"
                              style={{
                                padding: "4px 7px",
                                fontSize: 11,
                                fontWeight: 700,
                                background: "rgba(245, 158, 11, 0.12)",
                                borderColor: "rgba(245, 158, 11, 0.35)",
                                color: "#fbbf24",
                              }}
                            >
                              {extendingId === t.tenant_id ? "..." : "+48h"}
                            </button>

                            {/* 6. RAČUN / SPECIFIKACIJA */}
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setInvoiceModalTenant(t)}
                              title="Pregled specifikacije i izdavanje računa za zakup licence"
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                background: "rgba(255, 255, 255, 0.08)",
                                borderColor: "rgba(255, 255, 255, 0.2)",
                                color: "#ffffff",
                              }}
                            >
                              🧾 Račun
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* INLINE PROŠIRENI DETALJI UGOVORA I MODULA */}
                      {isExpanded && (
                        <tr style={{ background: "rgba(15, 23, 42, 0.65)" }}>
                          <td colSpan={8} style={{ padding: "16px 20px" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: 16,
                                background: "rgba(0, 0, 0, 0.3)",
                                padding: 18,
                                borderRadius: 12,
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                              }}
                            >
                              {/* 1. UGOVORENA PRETPLATA & MODULI */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.05em", marginBottom: 8 }}>
                                  📦 Ugovorena Pretplata & Obuhvat Modula
                                </div>
                                <div style={{ fontSize: 13, color: "#f8fafc", marginBottom: 4 }}>
                                  <strong>Paket:</strong> {t.plan_naziv || t.soccs_tier || "Standardni paket"}
                                </div>
                                <div style={{ fontSize: 13, color: "#f8fafc", marginBottom: 6 }}>
                                  <strong>Ugovorena cijena:</strong> {price.toFixed(2)} {ccy} / mjesečno
                                </div>

                                <div style={{ fontSize: 11.5, color: "rgba(255, 255, 255, 0.55)", marginBottom: 6 }}>
                                  Aktivirani moduli u licenci:
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                                  {modules.length > 0 ? (
                                    modules.map((m: string) => (
                                      <span
                                        key={m}
                                        style={{
                                          fontSize: 10.5,
                                          fontWeight: 700,
                                          padding: "2px 7px",
                                          borderRadius: 5,
                                          background: "rgba(56, 189, 248, 0.15)",
                                          border: "1px solid rgba(56, 189, 248, 0.3)",
                                          color: "#38bdf8",
                                        }}
                                      >
                                        ✓ {m}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ fontSize: 11.5, color: "rgba(255, 255, 255, 0.4)" }}>
                                      Osnovni paket bez dodatnih podmodula
                                    </span>
                                  )}
                                </div>

                                {onOpenModules && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => onOpenModules(t)}
                                    style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}
                                  >
                                    ✎ Izmijeni obuhvat modula i paketa
                                  </button>
                                )}
                              </div>

                              {/* 2. PRAVNO LICE & UGOVORNI PODACI */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#a855f7", letterSpacing: "0.05em", marginBottom: 8 }}>
                                  🏢 Pravno Lice & Ugovorni Podaci
                                </div>
                                <div style={{ fontSize: 13, color: "#f8fafc", marginBottom: 3 }}>
                                  <strong>Klijent:</strong> {t.klijent_naziv || "Nije povezan sa CRM-om"}
                                </div>
                                {t.klijent_jib && (
                                  <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", marginBottom: 3 }}>
                                    <strong>JIB / Porezni broj:</strong> {t.klijent_jib}
                                  </div>
                                )}
                                {t.klijent_adresa && (
                                  <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", marginBottom: 3 }}>
                                    <strong>Adresa:</strong> {t.klijent_adresa}
                                  </div>
                                )}
                                <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", marginBottom: 3 }}>
                                  <strong>Račun prima:</strong> {t.billing_email || "Nije definisan email"}
                                </div>
                                {t.billing_phone && (
                                  <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", marginBottom: 6 }}>
                                    <strong>Telefon:</strong> {t.billing_phone}
                                  </div>
                                )}

                                {onOpenContact && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => onOpenContact(t)}
                                    style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1" }}
                                  >
                                    ✎ Uredi podatke klijenta i ugovorne bilješke
                                  </button>
                                )}
                              </div>

                              {/* 3. SIGURNOST, TOKEN & KONTROLA */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#fbbf24", letterSpacing: "0.05em", marginBottom: 8 }}>
                                  🔐 Licenca, Token & Kontrola Pristupa
                                </div>
                                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.7)", marginBottom: 4 }}>
                                  Puni aktivacioni token:
                                </div>
                                <div
                                  style={{
                                    background: "rgba(0,0,0,0.5)",
                                    padding: "6px 8px",
                                    borderRadius: 6,
                                    fontSize: 10.5,
                                    fontFamily: "monospace",
                                    color: "#38bdf8",
                                    wordBreak: "break-all",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    marginBottom: 8,
                                  }}
                                >
                                  {t.licence_token || "Token nije generisan"}
                                </div>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  {t.licence_token && (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => handleCopy(t.licence_token, t.tenant_id)}
                                      style={{ fontSize: 11, fontWeight: 700 }}
                                    >
                                      {copyFeedback === t.tenant_id ? "✓ Kopirano" : "📋 Kopiraj Token"}
                                    </button>
                                  )}

                                  {onOpenToken && (
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => onOpenToken(t)}
                                      style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}
                                    >
                                      🔄 Regeneriši Token / QR
                                    </button>
                                  )}

                                  {onToggleStatus && (
                                    isSuspended ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        disabled={statusSavingId === t.tenant_id}
                                        onClick={() => onToggleStatus(t.tenant_id, "AKTIVAN", t)}
                                        style={{ fontSize: 11, fontWeight: 800, color: "#34d399", borderColor: "rgba(16, 185, 129, 0.4)" }}
                                      >
                                        ✓ Odblokiraj rad tenanta
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        disabled={statusSavingId === t.tenant_id}
                                        onClick={() => onToggleStatus(t.tenant_id, "SUSPENDOVAN", t)}
                                        style={{ fontSize: 11, fontWeight: 800, color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                                      >
                                        ⛔ Blokiraj rad tenanta
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: PRO-RATA KALKULATOR */}
      {proRataOpen && (
        <div
          className="studio-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setProRataOpen(false)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 850, color: "#ffffff" }}>
                ⚡ Hetzner Pro-Rata Kalkulator
              </h3>
              <button
                type="button"
                onClick={() => setProRataOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(255, 255, 255, 0.5)", fontSize: 20, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.65)", marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
              Izračunava tačan srazmjerni iznos od dana potpisivanja ugovora do 1. u narednom mjesecu (bez opraštanja dana).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255, 255, 255, 0.7)", marginBottom: 6 }}>
                  Mjesečna ugovorena cijena zakupa:
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    className="input"
                    value={proRataPrice}
                    onChange={(e) => setProRataPrice(Number(e.target.value) || 0)}
                    style={{ flex: 1, fontSize: 15, fontWeight: 750 }}
                  />
                  <select
                    className="input"
                    value={proRataCurrency}
                    onChange={(e) => setProRataCurrency(e.target.value)}
                    style={{ width: 85 }}
                  >
                    <option value="KM">KM</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255, 255, 255, 0.7)", marginBottom: 6 }}>
                  Datum potpisivanja / početka zakupa:
                </label>
                <input
                  type="date"
                  className="input"
                  value={proRataDate}
                  onChange={(e) => setProRataDate(e.target.value)}
                  style={{ width: "100%", fontSize: 14 }}
                />
              </div>

              {/* REZULTAT PRO-RATA */}
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  borderRadius: 14,
                  padding: 16,
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 750, textTransform: "uppercase" }}>
                  Obračun do 1. {proRataResult.nextFirstOfMonthFormatted}:
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
                  <span style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.7)" }}>
                    Preostalo dana u mjesecu ({proRataResult.daysRemaining} od {proRataResult.daysInMonth}):
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 850, color: "#38bdf8" }}>
                    {proRataResult.proRataAmount} {proRataCurrency}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
                  Formula: ({proRataPrice} / {proRataResult.daysInMonth} dana) × {proRataResult.daysRemaining} preostalih dana
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setProRataOpen(false)}
                style={{ padding: "8px 20px" }}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: SPECIFIKACIJA RAČUNA ZA ZAKUP LICENCE */}
      {invoiceModalTenant && (
        <div
          className="studio-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setInvoiceModalTenant(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 580,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 850, color: "#ffffff" }}>
                🧾 Specifikacija Računa Pretplate
              </h3>
              <button
                type="button"
                onClick={() => setInvoiceModalTenant(null)}
                style={{ background: "none", border: "none", color: "rgba(255, 255, 255, 0.5)", fontSize: 20, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.03)", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>Tenant & Klijent:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  {invoiceModalTenant.naziv} ({invoiceModalTenant.klijent_naziv})
                </div>
                {invoiceModalTenant.klijent_jib && (
                  <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
                    JIB: {invoiceModalTenant.klijent_jib} · {invoiceModalTenant.klijent_is_ino ? "INO klijent (0% PDV, stopa K)" : "Domaće pravno lice"}
                  </div>
                )}
              </div>

              <div style={{ padding: 12, background: "rgba(255, 255, 255, 0.03)", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>Stavka za fakturisanje:</div>
                <div style={{ fontSize: 14, fontWeight: 750, color: "#38bdf8", marginTop: 2 }}>
                  Zakup softverske licence
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", marginTop: 4 }}>
                  Opis: <em>Zakup softverske licence za period {invoiceModalTenant.billing.billingPeriodDescription}</em>
                </div>
                <div style={{ fontSize: 16, fontWeight: 850, color: "#ffffff", marginTop: 8 }}>
                  Iznos: {Number(invoiceModalTenant.monthly_price).toFixed(2)} {invoiceModalTenant.currency || "KM"}
                </div>
              </div>

              <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.08)", borderRadius: 10, border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                <div style={{ fontSize: 11.5, color: "#fbbf24", fontWeight: 700 }}>
                  ⚖️ Zakonska procedura fiskalizacije i izvoda:
                </div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.75)", marginTop: 4, lineHeight: 1.45 }}>
                  Fiskalna faktura sa QR kodom generiše se u radno vrijeme nakon što uplata bude knjižena kroz bankovni izvod. Klijentu se na email šalje elektronska potvrda i obavještenje.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <Link
                href={`/fakture/wizard`}
                className="btn btn-primary"
                style={{ padding: "8px 18px", fontWeight: 750 }}
              >
                Kreiraj Fakturu u Wizardu ➔
              </Link>

              <button
                type="button"
                className="btn"
                onClick={() => setInvoiceModalTenant(null)}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
