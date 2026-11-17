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
}

export default function ModernTenantBillingView({
  tenants,
  klijenti,
  plans,
  onSwitchToClassic,
  onRefresh,
  onOpenNewTenant,
}: ModernTenantBillingViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [productFilter, setProductFilter] = useState<string>("ALL");

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
        if (ccy === "EUR") mrrEur += price;
        else mrrKm += price;
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
      if (statusFilter !== "ALL") {
        if (statusFilter === "GRACE" && t.billing.statusType !== "GRACE_PERIOD")
          return false;
        if (statusFilter === "SUSPENDED" && t.billing.statusType !== "SUSPENDOVAN")
          return false;
        if (statusFilter === "ACTIVE" && t.billing.statusType !== "PAID" && t.billing.statusType !== "PILOT")
          return false;
      }

      if (productFilter !== "ALL") {
        const prof = (t.studio_licence_profile || "").toUpperCase();
        if (productFilter === "ENTERSYS" && !prof.includes("ENTERSYS")) return false;
        if (productFilter === "FLUXAPOS" && !prof.includes("FLUXAPOS")) return false;
        if (productFilter === "DOCENTRE" && !prof.includes("JAVNENABAVKE")) return false;
        if (productFilter === "SOCCS" && !prof.includes("SOCCS")) return false;
        if (productFilter === "FLUXAX" && !prof.includes("FLUXAX")) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const n = String(t.naziv || "").toLowerCase();
        const kn = String(t.klijent_naziv || "").toLowerCase();
        const em = String(t.billing_email || "").toLowerCase();
        const tok = String(t.tenant_public_id || "").toLowerCase();
        if (!n.includes(q) && !kn.includes(q) && !em.includes(q) && !tok.includes(q))
          return false;
      }

      return true;
    });
  }, [enrichedTenants, statusFilter, productFilter, searchTerm]);

  // Brzo produženje za +48h (dok izvod putuje kroz banku)
  const handleGraceExtend = async (tenantId: number) => {
    setExtendingId(tenantId);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/tenant-admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grace-extend", tenant_id: tenantId, hours: 48 }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Greška pri produženju");
      setActionFeedback(d.message || "Licenca je uspješno produžena za +48h.");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Greška");
    } finally {
      setExtendingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. GORNJA KONTROLNA TRAKA SA PREKIDAČEM */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: 0.2 }}>
            SaaS Billing & Tenant Centar
          </div>
          <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.55)", marginTop: 2 }}>
            Hetzner model obračuna (1. u mjesecu) · Grace period do 14 dana · Automatsko produženje kroz bankovni izvod
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn"
            onClick={() => setProRataOpen(true)}
            style={{
              background: "rgba(59, 130, 246, 0.15)",
              color: "#93c5fd",
              borderColor: "rgba(59, 130, 246, 0.3)",
              fontWeight: 700,
            }}
          >
            ⚡ Pro-Rata Kalkulator
          </button>

          <button
            className="btn btn-primary"
            onClick={onOpenNewTenant}
            style={{ fontWeight: 700 }}
          >
            + Novi Tenant
          </button>

          <button
            className="btn"
            onClick={onSwitchToClassic}
            title="Prikaži puni klasični administratorski panel sa svim modulima i tokenima"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              color: "#e2e8f0",
              fontWeight: 650,
            }}
          >
            ⇄ Klasični Prikaz
          </button>
        </div>
      </div>

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
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Aktivni Tenanti
          </div>
          <div style={{ fontSize: 28, fontWeight: 850, color: "#ffffff", marginTop: 6 }}>
            {metrics.activeCount}
          </div>
          <div style={{ fontSize: 12, color: "#10b981", marginTop: 4 }}>
            Uredno aktivne organizacije
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Mjesečni Zakup (BAM)
          </div>
          <div style={{ fontSize: 26, fontWeight: 850, color: "#38bdf8", marginTop: 6 }}>
            {metrics.mrrKm} KM
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
            Domaće ugovorene licence
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Mjesečni Zakup (EUR)
          </div>
          <div style={{ fontSize: 26, fontWeight: 850, color: "#a855f7", marginTop: 6 }}>
            {metrics.mrrEur} €
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
            INO licence (0% PDV, stopa K)
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            background: metrics.graceCount > 0 ? "rgba(245, 158, 11, 0.1)" : "rgba(255, 255, 255, 0.03)",
            border: metrics.graceCount > 0 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: metrics.graceCount > 0 ? "#fbbf24" : "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Grace Period (Čeka Izvod)
          </div>
          <div style={{ fontSize: 28, fontWeight: 850, color: metrics.graceCount > 0 ? "#f59e0b" : "#ffffff", marginTop: 6 }}>
            {metrics.graceCount}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
            Rok do 14. u mjesecu
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            background: metrics.suspendedCount > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.03)",
            border: metrics.suspendedCount > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 750, color: metrics.suspendedCount > 0 ? "#fca5a5" : "rgba(255, 255, 255, 0.45)", textTransform: "uppercase" }}>
            Soft Suspenzija
          </div>
          <div style={{ fontSize: 28, fontWeight: 850, color: metrics.suspendedCount > 0 ? "#ef4444" : "#ffffff", marginTop: 6 }}>
            {metrics.suspendedCount}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
            Prekoračen rok bez uplate
          </div>
        </div>
      </div>

      {/* 3. FILTERI I BRZA PRETRAGA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 260 }}>
          <input
            className="input"
            type="text"
            placeholder="Pretraži tenante po nazivu, klijentu, emailu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", maxWidth: 380 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="ALL">Svi statusi</option>
            <option value="ACTIVE">Aktivno / Plaćeno</option>
            <option value="GRACE">U Grace periodu</option>
            <option value="SUSPENDED">Suspendovano</option>
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
          </select>
        </div>
      </div>

      {/* 4. MODERNA TABELA TENANATA */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div className="table-wrap">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>#ID</th>
                <th>Tenant & Pravno Lice</th>
                <th>Proizvod / Paket</th>
                <th style={{ width: 140 }}>Ugovoreni Zakup</th>
                <th style={{ width: 130 }}>Plaćeno Do</th>
                <th style={{ width: 160 }}>Status Licence</th>
                <th style={{ width: 200, textAlign: "right" }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "rgba(255, 255, 255, 0.4)" }}>
                    Nema tenanata koji odgovaraju izabranim filterima.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const b = t.billing as TenantBillingInfo;
                  const price = Number(t.monthly_price) || 0;
                  const ccy = t.currency || "KM";

                  return (
                    <tr key={t.tenant_id}>
                      <td style={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 700 }}>
                        {t.tenant_id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: "#ffffff", fontSize: 14 }}>
                          {t.naziv}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.55)", marginTop: 2 }}>
                          {t.klijent_naziv || "Nije povezan sa CRM klijentom"}
                          {t.klijent_jib ? ` · JIB: ${t.klijent_jib}` : ""}
                        </div>
                        {t.billing_email && (
                          <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>
                            ✉ {t.billing_email}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>
                          {t.studio_licence_profile || "FLUXA"}
                        </div>
                        {t.soccs_tier && (
                          <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.45)", marginTop: 1 }}>
                            Paket: {t.soccs_tier}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: "#ffffff", fontSize: 14 }}>
                          {price.toFixed(2)} {ccy}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.45)" }}>
                          mjesečno
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: b.isExpired ? "#fca5a5" : "#e2e8f0" }}>
                          {b.subscriptionEndsAtFormatted}
                        </div>
                      </td>
                      <td>
                        {b.statusType === "PAID" && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              fontSize: 11.5,
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
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#fbbf24",
                              fontSize: 11.5,
                              fontWeight: 750,
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                            }}
                            title={`Grace period ističe 14. u mjesecu. Klijent ima još ${b.graceDaysLeft} dana za uplatu.`}
                          >
                            ⏳ GRACE ({b.graceDaysLeft}d)
                          </span>
                        )}
                        {b.statusType === "SUSPENDOVAN" && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              fontSize: 11.5,
                              fontWeight: 750,
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            🛑 SUSPENDOVAN
                          </span>
                        )}
                        {b.statusType === "PILOT" && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: "rgba(59, 130, 246, 0.15)",
                              color: "#60a5fa",
                              fontSize: 11.5,
                              fontWeight: 750,
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                            }}
                          >
                            PILOT / TEST
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {/* Grace +48h brzo dugme */}
                          <button
                            className="btn"
                            disabled={extendingId === t.tenant_id}
                            onClick={() => handleGraceExtend(t.tenant_id)}
                            title="Produži licencu za +48h dok izvod ne legne kroz banku"
                            style={{
                              padding: "5px 9px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: "rgba(245, 158, 11, 0.12)",
                              borderColor: "rgba(245, 158, 11, 0.35)",
                              color: "#fbbf24",
                            }}
                          >
                            {extendingId === t.tenant_id ? "..." : "+48h"}
                          </button>

                          {/* Račun / Nalog specifikacija */}
                          <button
                            className="btn"
                            onClick={() => setInvoiceModalTenant(t)}
                            title="Pregled specifikacije i izdavanje računa za zakup licence"
                            style={{
                              padding: "5px 9px",
                              fontSize: 11.5,
                              fontWeight: 700,
                            }}
                          >
                            📄 Račun
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: PRO-RATA KALKULATOR (HETZNER MODEL) */}
      {proRataOpen && (
        <div className="modalOverlay" onClick={() => setProRataOpen(false)}>
          <div
            className="modalCard"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
              ⚡ Hetzner Pro-Rata Kalkulator Zakupa
            </div>
            <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.55)", marginTop: 4 }}>
              Precizan obračun za klijente koji počinju usred mjeseca. Prvi račun pokriva preostale dane, a od 1. narednog mjeseca ide puni mjesečni iznos.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
              <div>
                <label className="label">Ugovorena puna mjesečna cijena:</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={proRataPrice}
                    onChange={(e) => setProRataPrice(Number(e.target.value) || 0)}
                  />
                  <select
                    className="input"
                    value={proRataCurrency}
                    onChange={(e) => setProRataCurrency(e.target.value)}
                    style={{ width: 85 }}
                  >
                    <option value="KM">KM</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Datum početka korišćenja:</label>
                <input
                  className="input"
                  type="date"
                  value={proRataDate}
                  onChange={(e) => setProRataDate(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: "16px 20px",
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase" }}>
                Rezultat Pro-Rata Obračuna:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Broj dana u mjesecu:</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                    {proRataResult.daysInMonth} dana
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Preostalo do kraja mjeseca:</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                    {proRataResult.remainingDays} dana
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Dnevna tarifa:</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                    {proRataResult.dailyRate.toFixed(2)} {proRataCurrency} / dan
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Prvi račun za naplatu:</div>
                  <div style={{ fontSize: 20, fontWeight: 850, color: "#34d399" }}>
                    {proRataResult.proRataAmount.toFixed(2)} {proRataCurrency}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                ℹ️ Period važenja prvog računa: <strong>{proRataResult.startDateStr}</strong> do <strong>{proRataResult.endOfMonthStr}</strong>. Od 1. u narednom mjesecu naplaćuje se puni iznos od <strong>{proRataPrice.toFixed(2)} {proRataCurrency}</strong>.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={() => setProRataOpen(false)}>
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: SPECIFIKACIJA RAČUNA ZA ZAKUP LICENCE */}
      {invoiceModalTenant && (
        <div className="modalOverlay" onClick={() => setInvoiceModalTenant(null)}>
          <div
            className="modalCard"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 580 }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
              📄 Specifikacija Računa za Zakup Licence
            </div>
            <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.55)", marginTop: 4 }}>
              Podaci spremni za formalno fakturisanje prema ugovoru i zakonodavstvu.
            </div>

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Klijent / Naručilac:</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>
                  {invoiceModalTenant.klijent_naziv}
                </div>
                {invoiceModalTenant.klijent_jib && (
                  <div style={{ fontSize: 12, color: "#38bdf8" }}>
                    JIB / Poreski broj: {invoiceModalTenant.klijent_jib}
                  </div>
                )}
              </div>

              <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Artikal na računu:</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Zakup softverske licence — {invoiceModalTenant.studio_licence_profile || invoiceModalTenant.naziv}
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
                  Opis: Mjesečna pretplata za korišćenje softverskog paketa {invoiceModalTenant.studio_licence_profile || invoiceModalTenant.naziv} za tekući obračunski period.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Ugovoreni iznos:</div>
                  <div style={{ fontSize: 18, fontWeight: 850, color: "#34d399" }}>
                    {Number(invoiceModalTenant.monthly_price || 0).toFixed(2)} {invoiceModalTenant.currency || "KM"}
                  </div>
                </div>

                <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Poreski tretman:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: invoiceModalTenant.klijent_is_ino ? "#a855f7" : "#38bdf8" }}>
                    {invoiceModalTenant.klijent_is_ino ? "0% PDV (Stopa K — Član 15)" : "17% PDV (Standardni promet)"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.45,
                }}
              >
                ⚖️ <strong>Zakonska klauzula:</strong> Faktura je izdata elektronskim putem, punovažna je bez pečata i potpisa u skladu sa Zakonom o elektronskom dokumentu.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
              <button className="btn" onClick={() => setInvoiceModalTenant(null)}>
                Zatvori
              </button>

              <Link
                href={`/fakture/wizard`}
                className="btn btn-primary"
                style={{ fontWeight: 750 }}
              >
                Otvori Wizard Faktura ➔
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
