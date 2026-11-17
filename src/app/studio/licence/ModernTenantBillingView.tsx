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

// =========================================================================
// BIH FORMATED HELPERS (Tačka za hiljade, zarez za decimale, DD.MM.YYYY.)
// =========================================================================

export function formatNumberBiH(val: number | string | null | undefined, decimals = 2): string {
  const num = Number(val) || 0;
  const parts = num.toFixed(decimals).split(".");
  // Odvajanje hiljada tačkom (.)
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Decimalni zarez (,)
  return parts.join(",");
}

export function formatMoneyBiH(val: number | string | null | undefined, currency = "KM"): string {
  const ccy = currency === "EUR" || currency === "€" ? "€" : "KM";
  return `${formatNumberBiH(val, 2)} ${ccy}`;
}

export function formatDateBiH(val: string | null | undefined): string {
  if (!val) return "—";
  const s = String(val).trim().slice(0, 10);
  const parts = s.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
  }
  return s;
}

// Dosljedno mapiranje imena proizvoda u ekosistemu
export function formatProductName(profile: string | null | undefined): string {
  if (!profile) return "Fluxa Cloud";
  const p = profile.toUpperCase();
  if (p.includes("JAVNENABAVKE") || p.includes("DOCENTRE") || p.includes("DOKUMENTART")) return "DokumentArt";
  if (p.includes("FLUXAX")) return "FluxaX";
  if (p.includes("ENTERSYS")) return "EnterSYS";
  if (p.includes("FLUXAPOS")) return "FluxaPOS";
  if (p.includes("LOGISTIX")) return "LogistiX";
  if (p.includes("SOCCS")) return "SOCCS SwimVoice";
  if (p.includes("FLUXA")) return "Fluxa Cloud";
  return profile;
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

// Klasični stilovi standardnih desktop dugmića (Windows/Desktop aplikativni izgled)
const btnDesktop: React.CSSProperties = {
  borderRadius: 4,
  padding: "5px 11px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #3b4252",
  background: "#232936",
  color: "#e2e8f0",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  whiteSpace: "nowrap",
  transition: "all 0.15s ease",
};

const btnDesktopPrimary: React.CSSProperties = {
  ...btnDesktop,
  border: "1px solid #2563eb",
  background: "#1d4ed8",
  color: "#ffffff",
  fontWeight: 700,
};

const btnDesktopSuccess: React.CSSProperties = {
  ...btnDesktop,
  border: "1px solid #059669",
  background: "#047857",
  color: "#ffffff",
  fontWeight: 700,
};

const btnDesktopDanger: React.CSSProperties = {
  ...btnDesktop,
  border: "1px solid #b91c1c",
  background: "#991b1b",
  color: "#ffffff",
  fontWeight: 700,
};

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
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Prikaz: po klijentu (grupisano) ili po pojedinačnim licencama
  const [viewGrouping, setViewGrouping] = useState<"client" | "licence">("client");

  // Otvoreni klijenti u grupisanom prikazu
  const [expandedClientIds, setExpandedClientIds] = useState<Record<string, boolean>>({});

  // Prošireni red licence u pojedinačnom prikazu
  const [expandedLicenceId, setExpandedLicenceId] = useState<number | null>(null);

  // KPI Drilldown Modal
  const [kpiModalCategory, setKpiModalCategory] = useState<string | null>(null);

  // Pro-rata modal state
  const [proRataOpen, setProRataOpen] = useState(false);
  const [proRataPrice, setProRataPrice] = useState<number>(100);
  const [proRataCurrency, setProRataCurrency] = useState("KM");
  const [proRataDate, setProRataDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  // LogistiX Referral Kalkulator Modal State
  const [logisticxOpen, setLogisticxOpen] = useState(false);
  const [logTrucksCount, setLogTrucksCount] = useState<number>(20);
  const [logReferredTrucks, setLogReferredTrucks] = useState<number>(40);

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

  // Mapiraj klijente po ID-u direktno iz baze klijenata (sa emailom, JIB-om, adresom)
  const klijentMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const k of klijenti ?? []) {
      map.set(Number(k.klijent_id), k);
    }
    return map;
  }, [klijenti]);

  // Obogaćeni tenanti: EMAIL I PODACI SE UZIMAJU DIREKTNO IZ BAZE KLIJENATA
  const enrichedTenants = useMemo(() => {
    return (tenants ?? []).map((t) => {
      const billing = getTenantBillingInfo(t);
      const kl = t.klijent_id ? klijentMap.get(Number(t.klijent_id)) : null;

      // Prioritet za kontakt email: baza klijenata (klijenti.email), zatim billing_email iz tenanta
      const resolvedEmail = (kl?.email && String(kl.email).trim() !== "")
        ? String(kl.email).trim()
        : (t.billing_email ? String(t.billing_email).trim() : null);

      const resolvedJib = kl?.jib || kl?.porezni_id || kl?.pib || null;
      const resolvedAddress = [kl?.adresa, kl?.grad].filter(Boolean).join(", ") || null;
      const resolvedClientName = kl?.naziv_klijenta || t.naziv;

      return {
        ...t,
        billing,
        klijent_naziv: resolvedClientName,
        klijent_email: resolvedEmail,
        klijent_jib: resolvedJib,
        klijent_adresa: resolvedAddress,
        klijent_is_ino: Boolean(kl?.is_ino),
        product_display_name: formatProductName(t.studio_licence_profile),
      };
    });
  }, [tenants, klijentMap]);

  // KPI metrike
  const metrics = useMemo(() => {
    let activeCount = 0;
    let pilotCount = 0;
    let graceCount = 0;
    let suspendedCount = 0;
    let mrrKm = 0;
    let mrrEur = 0;

    for (const t of enrichedTenants) {
      const price = Number(t.monthly_price) || 0;
      const ccy = (t.currency || "KM").toUpperCase();

      if (t.billing.statusType === "PAID") {
        activeCount++;
      }
      if (t.billing.statusType === "PILOT") {
        pilotCount++;
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
      pilotCount,
      graceCount,
      suspendedCount,
      mrrKm,
      mrrEur,
    };
  }, [enrichedTenants]);

  // Filtrirani tenanti
  const filteredTenants = useMemo(() => {
    return enrichedTenants.filter((t) => {
      // 1. Sakrivanje arhiviranih/bivših ako nije označeno
      if (!showArchived && t.billing.statusType === "SUSPENDOVAN") {
        // Ako je izričito odabran SUSPENDED filter, onda prikaži
        if (statusFilter !== "SUSPENDED") {
          // Sakrij bivše korisnike ako korisnik nije zatražio arhivu
          // (ostavi samo ako pretražuje po imenu)
          if (!searchTerm.trim()) return false;
        }
      }

      // 2. Pretraga
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (t.naziv || "").toLowerCase().includes(q);
        const matchesClient = (t.klijent_naziv || "").toLowerCase().includes(q);
        const matchesEmail = (t.klijent_email || "").toLowerCase().includes(q);
        const matchesToken = (t.licence_token || "").toLowerCase().includes(q);
        const matchesId = String(t.tenant_id).includes(q);
        if (!matchesName && !matchesClient && !matchesEmail && !matchesToken && !matchesId) return false;
      }

      // 3. Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && t.billing.statusType !== "PAID") return false;
        if (statusFilter === "PILOT" && t.billing.statusType !== "PILOT") return false;
        if (statusFilter === "GRACE" && t.billing.statusType !== "GRACE_PERIOD") return false;
        if (statusFilter === "SUSPENDED" && t.billing.statusType !== "SUSPENDOVAN") return false;
      }

      // 4. Product filter
      if (productFilter !== "ALL") {
        const prod = (t.studio_licence_profile || "").toUpperCase();
        if (productFilter === "ENTERSYS" && !prod.includes("ENTERSYS")) return false;
        if (productFilter === "FLUXAPOS" && !prod.includes("FLUXAPOS")) return false;
        if (productFilter === "DOCENTRE" && !prod.includes("JAVNENABAVKE") && !prod.includes("DOCENTRE") && !prod.includes("DOKUMENTART")) return false;
        if (productFilter === "SOCCS" && !prod.includes("SOCCS")) return false;
        if (productFilter === "FLUXAX" && !prod.includes("FLUXAX")) return false;
        if (productFilter === "LOGISTIX" && !prod.includes("LOGISTIX")) return false;
        if (productFilter === "FLUXA" && (!prod.includes("FLUXA") || prod.includes("FLUXAPOS") || prod.includes("FLUXAX"))) return false;
      }

      return true;
    });
  }, [enrichedTenants, searchTerm, statusFilter, productFilter, showArchived]);

  // GRUPISANI TENANTI PO KLIJENTU (13 licenci = 4-6 klijenata)
  const clientGroups = useMemo(() => {
    const groups = new Map<string, {
      clientId: string;
      clientName: string;
      email: string | null;
      jib: string | null;
      address: string | null;
      tenants: any[];
      totalKm: number;
      totalEur: number;
      hasGrace: boolean;
      hasSuspended: boolean;
      allPilot: boolean;
    }>();

    for (const t of filteredTenants) {
      const key = t.klijent_id ? `klijent_${t.klijent_id}` : `tenant_unlinked_${t.tenant_id}`;
      const name = t.klijent_naziv || t.naziv;

      if (!groups.has(key)) {
        groups.set(key, {
          clientId: key,
          clientName: name,
          email: t.klijent_email,
          jib: t.klijent_jib,
          address: t.klijent_adresa,
          tenants: [],
          totalKm: 0,
          totalEur: 0,
          hasGrace: false,
          hasSuspended: false,
          allPilot: true,
        });
      }

      const g = groups.get(key)!;
      g.tenants.push(t);

      const price = Number(t.monthly_price) || 0;
      const ccy = (t.currency || "KM").toUpperCase();
      if (t.billing.statusType !== "SUSPENDOVAN") {
        if (ccy === "EUR" || ccy === "€") g.totalEur += price;
        else g.totalKm += price;
      }

      if (t.billing.statusType === "GRACE_PERIOD") g.hasGrace = true;
      if (t.billing.statusType === "SUSPENDOVAN") g.hasSuspended = true;
      if (t.billing.statusType !== "PILOT") g.allPilot = false;
    }

    return Array.from(groups.values());
  }, [filteredTenants]);

  // Tenanti za KPI drilldown modal
  const kpiDrilldownTenants = useMemo(() => {
    if (!kpiModalCategory) return [];
    if (kpiModalCategory === "ACTIVE") {
      return enrichedTenants.filter((t) => t.billing.statusType === "PAID" || t.billing.statusType === "GRACE_PERIOD");
    }
    if (kpiModalCategory === "PILOT") {
      return enrichedTenants.filter((t) => t.billing.statusType === "PILOT");
    }
    if (kpiModalCategory === "GRACE") {
      return enrichedTenants.filter((t) => t.billing.statusType === "GRACE_PERIOD");
    }
    if (kpiModalCategory === "SUSPENDED") {
      return enrichedTenants.filter((t) => t.billing.statusType === "SUSPENDOVAN");
    }
    if (kpiModalCategory === "MRR_KM") {
      return enrichedTenants.filter((t) => (t.currency || "KM").toUpperCase() !== "EUR" && Number(t.monthly_price) > 0 && t.billing.statusType !== "SUSPENDOVAN");
    }
    if (kpiModalCategory === "MRR_EUR") {
      return enrichedTenants.filter((t) => (t.currency || "KM").toUpperCase() === "EUR" && Number(t.monthly_price) > 0 && t.billing.statusType !== "SUSPENDOVAN");
    }
    return [];
  }, [kpiModalCategory, enrichedTenants]);

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

      setActionFeedback(`Uspješno produžen grace period za 48h (Novi rok: ${formatDateBiH(data.new_ends_at)}).`);
      onRefresh();
    } catch (err: any) {
      alert("Greška: " + err.message);
    } finally {
      setExtendingId(null);
    }
  };

  const handleCopy = (text: string, id: number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const toggleClientExpand = (clientId: string) => {
    setExpandedClientIds((prev) => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", color: "#cbd5e1" }}>
      {/* 1. HEADER I GLAVNE KOMANDE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          paddingBottom: 14,
          borderBottom: "1px solid #2d3748",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>
            SaaS Billing & Tenant Centar
          </h2>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
            Ciklus 1. u mjesecu · 14 dana tolerancija · Podaci klijenta iz CRM baze · Pregled po klijentima i licencama
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Preklopnik prikaza */}
          <div style={{ display: "inline-flex", background: "#1e2430", padding: 2, borderRadius: 5, border: "1px solid #334155" }}>
            <button
              type="button"
              onClick={() => setViewGrouping("client")}
              style={{
                ...btnDesktop,
                border: "none",
                background: viewGrouping === "client" ? "#2563eb" : "transparent",
                color: viewGrouping === "client" ? "#ffffff" : "#94a3b8",
                fontWeight: viewGrouping === "client" ? 700 : 500,
              }}
            >
              🏢 Po Klijentima ({clientGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setViewGrouping("licence")}
              style={{
                ...btnDesktop,
                border: "none",
                background: viewGrouping === "licence" ? "#2563eb" : "transparent",
                color: viewGrouping === "licence" ? "#ffffff" : "#94a3b8",
                fontWeight: viewGrouping === "licence" ? 700 : 500,
              }}
            >
              📄 Sve Licence ({filteredTenants.length})
            </button>
          </div>

          <button
            type="button"
            style={btnDesktop}
            onClick={() => setLogisticxOpen(true)}
            title="LogistiX obračun po broju kamiona i referral popusti za preporučene klijente"
          >
            🚚 LogistiX Model
          </button>

          <button
            type="button"
            style={btnDesktop}
            onClick={() => setProRataOpen(true)}
            title="Izračunaj iznos zakupa od potpisivanja do 1. u narednom mjesecu"
          >
            ⚡ Pro-Rata
          </button>

          <button
            type="button"
            style={btnDesktopPrimary}
            onClick={onOpenNewTenant}
          >
            + Novi Tenant
          </button>

          <button
            type="button"
            style={btnDesktop}
            onClick={onSwitchToClassic}
            title="Prebaci na klasični tabularni prikaz"
          >
            ⇄ Klasični Prikaz
          </button>
        </div>
      </div>

      {/* FEEDBACK NOTIFIKACIJA */}
      {actionFeedback && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 4,
            background: "#064e3b",
            border: "1px solid #059669",
            color: "#a7f3d0",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {actionFeedback}</span>
          <button
            onClick={() => setActionFeedback(null)}
            style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. INTERAKTIVNE KPI KARTICE (Klik otvara detaljnu listu klijenata) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          width: "100%",
        }}
      >
        {/* AKTIVNI */}
        <div
          onClick={() => setKpiModalCategory("ACTIVE")}
          style={{
            padding: "14px 16px",
            background: "#18202c",
            border: "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled aktivnih tenanata"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Aktivne Licence
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc", marginTop: 4 }}>
            {metrics.activeCount}
          </div>
          <div style={{ fontSize: 11.5, color: "#10b981", marginTop: 3 }}>
            ● Uredne uplate
          </div>
        </div>

        {/* PILOT STATUS (Novo!) */}
        <div
          onClick={() => setKpiModalCategory("PILOT")}
          style={{
            padding: "14px 16px",
            background: "#18202c",
            border: "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled klijenata u pilot / test statusu"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Pilot / Test Status
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
            {metrics.pilotCount}
          </div>
          <div style={{ fontSize: 11.5, color: "#60a5fa", marginTop: 3 }}>
            ● Testni period
          </div>
        </div>

        {/* MRR BAM */}
        <div
          onClick={() => setKpiModalCategory("MRR_KM")}
          style={{
            padding: "14px 16px",
            background: "#18202c",
            border: "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled domaćih ugovorenih licenci"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Mjesečni Zakup (BAM)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginTop: 4 }}>
            {formatMoneyBiH(metrics.mrrKm, "KM")}
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>
            Domaće licence
          </div>
        </div>

        {/* MRR EUR */}
        <div
          onClick={() => setKpiModalCategory("MRR_EUR")}
          style={{
            padding: "14px 16px",
            background: "#18202c",
            border: "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled INO licenci"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Mjesečni Zakup (EUR)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginTop: 4 }}>
            {formatMoneyBiH(metrics.mrrEur, "EUR")}
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>
            INO (0% PDV, stopa K)
          </div>
        </div>

        {/* GRACE PERIOD */}
        <div
          onClick={() => setKpiModalCategory("GRACE")}
          style={{
            padding: "14px 16px",
            background: metrics.graceCount > 0 ? "#2d2010" : "#18202c",
            border: metrics.graceCount > 0 ? "1px solid #b45309" : "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled klijenata u grace periodu (rok do 14. u mjesecu)"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: metrics.graceCount > 0 ? "#f59e0b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Grace Period (Čeka Izvod)
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: metrics.graceCount > 0 ? "#fbbf24" : "#f8fafc", marginTop: 4 }}>
            {metrics.graceCount}
          </div>
          <div style={{ fontSize: 11.5, color: metrics.graceCount > 0 ? "#f59e0b" : "#94a3b8", marginTop: 3 }}>
            ● Tolerancija do 14-og
          </div>
        </div>

        {/* BLOKIRANO / SUSPENDOVANO */}
        <div
          onClick={() => setKpiModalCategory("SUSPENDED")}
          style={{
            padding: "14px 16px",
            background: metrics.suspendedCount > 0 ? "#2d1515" : "#18202c",
            border: metrics.suspendedCount > 0 ? "1px solid #991b1b" : "1px solid #2d3748",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Klikni za pregled blokiranih / suspendovanih licenci"
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: metrics.suspendedCount > 0 ? "#f87171" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Blokirano / Suspendovano
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: metrics.suspendedCount > 0 ? "#f87171" : "#f8fafc", marginTop: 4 }}>
            {metrics.suspendedCount}
          </div>
          <div style={{ fontSize: 11.5, color: metrics.suspendedCount > 0 ? "#f87171" : "#94a3b8", marginTop: 3 }}>
            ● Prekid pristupa softveru
          </div>
        </div>
      </div>

      {/* 3. PRETRAGA I PAMETNI FILTERI */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "10px 14px",
          background: "#161b22",
          border: "1px solid #2d3748",
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", gap: 10, flex: "1 1 300px", maxWidth: 440 }}>
          <input
            type="text"
            placeholder="Pretraži po nazivu klijenta, tenanta, emailu, tokenu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 12px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#f8fafc",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#f8fafc",
              fontSize: 12.5,
            }}
          >
            <option value="ALL">Svi statusi</option>
            <option value="ACTIVE">Aktivno (Plaćeno)</option>
            <option value="PILOT">Pilot / Test</option>
            <option value="GRACE">U Grace periodu (do 14-og)</option>
            <option value="SUSPENDED">Blokirano / Suspendovano</option>
          </select>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#f8fafc",
              fontSize: 12.5,
            }}
          >
            <option value="ALL">Svi proizvodi</option>
            <option value="ENTERSYS">EnterSYS</option>
            <option value="FLUXAPOS">FluxaPOS</option>
            <option value="DOCENTRE">DokumentArt</option>
            <option value="LOGISTIX">LogistiX</option>
            <option value="FLUXAX">FluxaX</option>
            <option value="SOCCS">SOCCS SwimVoice</option>
            <option value="FLUXA">Fluxa Cloud</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#94a3b8",
              cursor: "pointer",
              marginLeft: 6,
            }}
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Prikaži arhivirane / neaktivne
          </label>
        </div>
      </div>

      {/* 4. GLAVNI PRIKAZ: PO KLIJENTIMA (DEFAULT) ILI PO LICENCAMA */}
      {viewGrouping === "client" ? (
        /* ===================================================================
           A) GRUPISANI PREGLED PO KLIJENTU (Jedan klijent -> Više licenci)
           =================================================================== */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clientGroups.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, background: "#161b22", borderRadius: 6, border: "1px solid #2d3748" }}>
              Nema klijenata koji odgovaraju izabranim filterima.
            </div>
          ) : (
            clientGroups.map((g) => {
              const isExpanded = Boolean(expandedClientIds[g.clientId]);

              return (
                <div
                  key={g.clientId}
                  style={{
                    background: "#18202c",
                    border: isExpanded ? "1px solid #3b82f6" : "1px solid #2d3748",
                    borderRadius: 6,
                    overflow: "hidden",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* ZAGLAVLJE KLIJENTA */}
                  <div
                    style={{
                      padding: "12px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      background: isExpanded ? "#1e293b" : "#1a2230",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 320px" }}>
                      <button
                        type="button"
                        onClick={() => toggleClientExpand(g.clientId)}
                        style={{
                          background: "#242f42",
                          border: "1px solid #3b4860",
                          color: "#cbd5e1",
                          borderRadius: 4,
                          padding: "3px 8px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "▲ Sakrij" : "▼ Licence (" + g.tenants.length + ")"}
                      </button>

                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>
                            {g.clientName}
                          </span>
                          {g.jib && (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>
                              JIB: {g.jib}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, display: "flex", gap: 14 }}>
                          {g.email ? (
                            <span style={{ color: "#38bdf8" }}>✉ {g.email} (iz CRM baze)</span>
                          ) : (
                            <span style={{ color: "#64748b" }}>Nema emaila u bazi</span>
                          )}
                          {g.address && <span>📍 {g.address}</span>}
                        </div>
                      </div>
                    </div>

                    {/* SUMARNI PODACI KLIJENTA */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* Proizvodi koje koristi */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {g.tenants.map((t) => (
                          <span
                            key={t.tenant_id}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#242f42",
                              border: "1px solid #374763",
                              color: "#cbd5e1",
                            }}
                          >
                            {t.product_display_name}
                          </span>
                        ))}
                      </div>

                      {/* Ukupan zakup klijenta */}
                      <div style={{ textAlign: "right", minWidth: 120 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>
                          {g.totalEur > 0
                            ? `${formatMoneyBiH(g.totalKm, "KM")} + ${formatMoneyBiH(g.totalEur, "EUR")}`
                            : formatMoneyBiH(g.totalKm, "KM")}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#64748b" }}>
                          ukupno mjesečno
                        </div>
                      </div>

                      {/* Status bedž */}
                      <div style={{ minWidth: 100, textAlign: "right" }}>
                        {g.hasSuspended ? (
                          <span style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>● Blokirano</span>
                        ) : g.hasGrace ? (
                          <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700 }}>● U Grace-u</span>
                        ) : g.allPilot ? (
                          <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>● Pilot</span>
                        ) : (
                          <span style={{ color: "#34d399", fontSize: 12, fontWeight: 700 }}>● Aktivan</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RAŠČLANJENE LICENCE OVOG KLIJENTA (Rasklapa se) */}
                  {isExpanded && (
                    <div style={{ padding: "12px 16px", background: "#111620", borderTop: "1px solid #2d3748" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #263040" }}>
                            <th style={{ padding: "6px 8px", width: 45 }}>#ID</th>
                            <th style={{ padding: "6px 8px" }}>Aplikacija & Paket</th>
                            <th style={{ padding: "6px 8px" }}>Licence Token</th>
                            <th style={{ padding: "6px 8px" }}>Ugovoreno</th>
                            <th style={{ padding: "6px 8px" }}>Plaćeno Do</th>
                            <th style={{ padding: "6px 8px" }}>Status</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>Upravljanje Licencom</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.tenants.map((t) => {
                            const b = t.billing as TenantBillingInfo;
                            const isSusp = String(t.status).toUpperCase() === "SUSPENDOVAN";

                            return (
                              <tr key={t.tenant_id} style={{ borderBottom: "1px solid #1e2636" }}>
                                <td style={{ padding: "8px 8px", color: "#64748b" }}>{t.tenant_id}</td>
                                <td style={{ padding: "8px 8px" }}>
                                  <div style={{ fontWeight: 700, color: "#f8fafc" }}>
                                    {t.product_display_name}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748b" }}>
                                    {t.plan_naziv || t.soccs_tier || "Standardni paket"}
                                  </div>
                                </td>
                                <td style={{ padding: "8px 8px" }}>
                                  {t.licence_token ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <code style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: 11 }}>
                                        {String(t.licence_token).slice(0, 10)}...
                                      </code>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(t.licence_token, t.tenant_id)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 11 }}
                                        title="Kopiraj puni token"
                                      >
                                        {copyFeedback === t.tenant_id ? "✓" : "📋"}
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#64748b" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "8px 8px", fontWeight: 700, color: "#f8fafc" }}>
                                  {formatMoneyBiH(t.monthly_price, t.currency || "KM")}
                                </td>
                                <td style={{ padding: "8px 8px", color: b.isExpired ? "#fca5a5" : "#cbd5e1" }}>
                                  {formatDateBiH(t.subscription_ends_at)}
                                </td>
                                <td style={{ padding: "8px 8px" }}>
                                  {b.statusType === "PAID" && <span style={{ color: "#34d399", fontWeight: 700 }}>● Aktivan</span>}
                                  {b.statusType === "PILOT" && <span style={{ color: "#60a5fa", fontWeight: 700 }}>● Pilot</span>}
                                  {b.statusType === "GRACE_PERIOD" && <span style={{ color: "#fbbf24", fontWeight: 700 }}>● Grace ({b.graceDaysLeft}d)</span>}
                                  {b.statusType === "SUSPENDOVAN" && <span style={{ color: "#f87171", fontWeight: 700 }}>● Blokiran</span>}
                                </td>
                                <td style={{ padding: "8px 8px", textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                    {onOpenToken && (
                                      <button
                                        type="button"
                                        style={btnDesktop}
                                        onClick={() => onOpenToken(t)}
                                        title="Pregled tokena, QR koda i regeneracija"
                                      >
                                        🔑 Token
                                      </button>
                                    )}

                                    {onOpenModules && (
                                      <button
                                        type="button"
                                        style={btnDesktop}
                                        onClick={() => onOpenModules(t)}
                                        title="Zakupljeni moduli i paketi"
                                      >
                                        📦 Moduli
                                      </button>
                                    )}

                                    {onToggleStatus && (
                                      isSusp ? (
                                        <button
                                          type="button"
                                          style={btnDesktopSuccess}
                                          disabled={statusSavingId === t.tenant_id}
                                          onClick={() => onToggleStatus(t.tenant_id, "AKTIVAN", t)}
                                          title="Odblokiraj rad"
                                        >
                                          ✓ Odblokiraj
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          style={btnDesktopDanger}
                                          disabled={statusSavingId === t.tenant_id}
                                          onClick={() => onToggleStatus(t.tenant_id, "SUSPENDOVAN", t)}
                                          title="Blokiraj pristup softveru"
                                        >
                                          ⛔ Blokiraj
                                        </button>
                                      )
                                    )}

                                    <button
                                      type="button"
                                      style={btnDesktop}
                                      disabled={extendingId === t.tenant_id}
                                      onClick={() => handleGraceExtend(t.tenant_id)}
                                      title="Brzo produženje za 48h dok izvod ne legne"
                                    >
                                      +48h
                                    </button>

                                    <button
                                      type="button"
                                      style={btnDesktop}
                                      onClick={() => setInvoiceModalTenant(t)}
                                      title="Specifikacija i račun za zakup"
                                    >
                                      🧾 Račun
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ===================================================================
           B) POJEDINAČNA TABELA SVIH LICENCI
           =================================================================== */
        <div
          style={{
            background: "#18202c",
            border: "1px solid #2d3748",
            borderRadius: 6,
            overflowX: "auto",
            width: "100%",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#161b22", color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #2d3748" }}>
                <th style={{ padding: "10px 12px", width: 45 }}>#ID</th>
                <th style={{ padding: "10px 12px", minWidth: 200 }}>Tenant & Pravno Lice</th>
                <th style={{ padding: "10px 12px", minWidth: 150 }}>Proizvod & Paket</th>
                <th style={{ padding: "10px 12px", minWidth: 130 }}>Licence Token</th>
                <th style={{ padding: "10px 12px", minWidth: 110 }}>Ugovoreno</th>
                <th style={{ padding: "10px 12px", minWidth: 105 }}>Plaćeno Do</th>
                <th style={{ padding: "10px 12px", minWidth: 115 }}>Status</th>
                <th style={{ padding: "10px 12px", textAlign: "right", minWidth: 280 }}>Upravljanje & Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                    Nema tenanata koji odgovaraju izabranim filterima.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const b = t.billing as TenantBillingInfo;
                  const isSusp = String(t.status).toUpperCase() === "SUSPENDOVAN";
                  const isExp = expandedLicenceId === t.tenant_id;
                  const modules = parseScopeModules(t.soccs_platform_scope);

                  return (
                    <React.Fragment key={t.tenant_id}>
                      <tr style={{ borderBottom: "1px solid #222b3b", background: isExp ? "#1e293b" : "transparent" }}>
                        <td style={{ padding: "10px 12px", color: "#64748b", fontWeight: 700 }}>
                          {t.tenant_id}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: 13.5 }}>
                              {t.naziv}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedLicenceId(isExp ? null : t.tenant_id)}
                              style={{
                                background: "none",
                                border: "1px solid #374151",
                                borderRadius: 3,
                                color: "#94a3b8",
                                fontSize: 10.5,
                                padding: "1px 5px",
                                cursor: "pointer",
                              }}
                            >
                              {isExp ? "▲" : "▼"}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                            {t.klijent_naziv} {t.klijent_jib ? `· JIB: ${t.klijent_jib}` : ""}
                          </div>
                          {t.klijent_email && (
                            <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 1 }}>
                              ✉ {t.klijent_email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "#f8fafc" }}>
                            {t.product_display_name}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {t.plan_naziv || t.soccs_tier || "Standardni paket"}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {t.licence_token ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <code style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: 11 }}>
                                {String(t.licence_token).slice(0, 10)}...
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopy(t.licence_token, t.tenant_id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
                                title="Kopiraj puni token"
                              >
                                {copyFeedback === t.tenant_id ? "✓" : "📋"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f8fafc" }}>
                          {formatMoneyBiH(t.monthly_price, t.currency || "KM")}
                        </td>
                        <td style={{ padding: "10px 12px", color: b.isExpired ? "#fca5a5" : "#cbd5e1" }}>
                          {formatDateBiH(t.subscription_ends_at)}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {b.statusType === "PAID" && <span style={{ color: "#34d399", fontWeight: 700 }}>● Aktivan</span>}
                          {b.statusType === "PILOT" && <span style={{ color: "#60a5fa", fontWeight: 700 }}>● Pilot</span>}
                          {b.statusType === "GRACE_PERIOD" && <span style={{ color: "#fbbf24", fontWeight: 700 }}>● Grace ({b.graceDaysLeft}d)</span>}
                          {b.statusType === "SUSPENDOVAN" && <span style={{ color: "#f87171", fontWeight: 700 }}>● Blokiran</span>}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                            {onOpenToken && (
                              <button
                                type="button"
                                style={btnDesktop}
                                onClick={() => onOpenToken(t)}
                                title="Token & QR kod"
                              >
                                🔑 Token
                              </button>
                            )}
                            {onOpenModules && (
                              <button
                                type="button"
                                style={btnDesktop}
                                onClick={() => onOpenModules(t)}
                                title="Moduli i paketi"
                              >
                                📦 Moduli
                              </button>
                            )}
                            {onToggleStatus && (
                              isSusp ? (
                                <button
                                  type="button"
                                  style={btnDesktopSuccess}
                                  disabled={statusSavingId === t.tenant_id}
                                  onClick={() => onToggleStatus(t.tenant_id, "AKTIVAN", t)}
                                >
                                  ✓ Odblokiraj
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  style={btnDesktopDanger}
                                  disabled={statusSavingId === t.tenant_id}
                                  onClick={() => onToggleStatus(t.tenant_id, "SUSPENDOVAN", t)}
                                >
                                  ⛔ Blokiraj
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              style={btnDesktop}
                              disabled={extendingId === t.tenant_id}
                              onClick={() => handleGraceExtend(t.tenant_id)}
                              title="Brzo produženje +48h"
                            >
                              +48h
                            </button>
                            <button
                              type="button"
                              style={btnDesktop}
                              onClick={() => setInvoiceModalTenant(t)}
                            >
                              🧾 Račun
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* RASKLOPIVI DETALJI */}
                      {isExp && (
                        <tr style={{ background: "#111620" }}>
                          <td colSpan={8} style={{ padding: "14px 18px", borderBottom: "1px solid #2d3748" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                                  Ugovoreni moduli
                                </div>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                                  {modules.length > 0 ? (
                                    modules.map((m) => (
                                      <span key={m} style={{ fontSize: 11, background: "#1e293b", padding: "2px 6px", borderRadius: 3, color: "#e2e8f0" }}>
                                        ✓ {m}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ fontSize: 12, color: "#64748b" }}>Osnovni modul</span>
                                  )}
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", textTransform: "uppercase" }}>
                                  CRM Klijent & Fakturisanje
                                </div>
                                <div style={{ fontSize: 12.5, color: "#e2e8f0", marginTop: 4 }}>
                                  {t.klijent_naziv} {t.klijent_jib ? `· JIB: ${t.klijent_jib}` : ""}
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                  Email za račun: {t.klijent_email || "Nije postavljen"}
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>
                                  Puni aktivacioni token
                                </div>
                                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#38bdf8", wordBreak: "break-all", marginTop: 4 }}>
                                  {t.licence_token || "—"}
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
      )}

      {/* 5. MODAL: KPI DRILLDOWN (Klik na bilo koji KPI broj otvara listu) */}
      {kpiModalCategory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setKpiModalCategory(null)}
        >
          <div
            style={{
              background: "#18202c",
              border: "1px solid #374151",
              borderRadius: 6,
              padding: 22,
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2d3748", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#f8fafc" }}>
                {kpiModalCategory === "ACTIVE" && "Pregled Aktivnih Tenanata"}
                {kpiModalCategory === "PILOT" && "Pregled Klijenata u Pilot / Test Statusu"}
                {kpiModalCategory === "GRACE" && "Klijenti u Grace Periodu (Rok do 14-og)"}
                {kpiModalCategory === "SUSPENDED" && "Blokirani i Suspendovani Tenanti"}
                {kpiModalCategory === "MRR_KM" && "Ugovoreni Domaći Zakup (BAM)"}
                {kpiModalCategory === "MRR_EUR" && "Ugovoreni INO Zakup (EUR)"}
              </h3>
              <button
                type="button"
                onClick={() => setKpiModalCategory(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: "#94a3b8", borderBottom: "1px solid #2d3748", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Tenant</th>
                    <th style={{ padding: "6px 8px" }}>Aplikacija</th>
                    <th style={{ padding: "6px 8px" }}>Zakup</th>
                    <th style={{ padding: "6px 8px" }}>Plaćeno Do</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiDrilldownTenants.map((t) => (
                    <tr key={t.tenant_id} style={{ borderBottom: "1px solid #1e2636" }}>
                      <td style={{ padding: "8px 8px" }}>
                        <div style={{ fontWeight: 700, color: "#f8fafc" }}>{t.naziv}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.klijent_naziv}</div>
                      </td>
                      <td style={{ padding: "8px 8px" }}>{t.product_display_name}</td>
                      <td style={{ padding: "8px 8px", fontWeight: 700, color: "#f8fafc" }}>
                        {formatMoneyBiH(t.monthly_price, t.currency || "KM")}
                      </td>
                      <td style={{ padding: "8px 8px" }}>{formatDateBiH(t.subscription_ends_at)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>
                        <button
                          type="button"
                          style={btnDesktop}
                          onClick={() => {
                            setKpiModalCategory(null);
                            if (onOpenToken) onOpenToken(t);
                          }}
                        >
                          Upravljaj ➔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                style={btnDesktopPrimary}
                onClick={() => setKpiModalCategory(null)}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: LOGISTIX FLOTA & REFERRAL KALKULATOR */}
      {logisticxOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setLogisticxOpen(false)}
        >
          <div
            style={{
              background: "#18202c",
              border: "1px solid #374151",
              borderRadius: 6,
              padding: 24,
              width: "100%",
              maxWidth: 580,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2d3748", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                🚚 LogistiX Flota & Referral Model
              </h3>
              <button
                type="button"
                onClick={() => setLogisticxOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
              Formula: <strong>1 kamion = 1 KM po danu</strong> (30 dana = 30 KM / mjesec po kamionu).
              <br />
              Referral popust: Za svakog novog klijenta kojeg dovede, dobija <strong>50% popusta po kamionu</strong> (15 KM / mjesec po preporučenom kamionu).
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5 }}>
                  Broj kamiona klijenta u floti:
                </label>
                <input
                  type="number"
                  value={logTrucksCount}
                  onChange={(e) => setLogTrucksCount(Math.max(0, Number(e.target.value) || 0))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 4,
                    color: "#f8fafc",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5 }}>
                  Broj kamiona koje su doveli preporučeni klijenti (Referral):
                </label>
                <input
                  type="number"
                  value={logReferredTrucks}
                  onChange={(e) => setLogReferredTrucks(Math.max(0, Number(e.target.value) || 0))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 4,
                    color: "#f8fafc",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* OBRAČUN */}
              {(() => {
                const baseMonthly = logTrucksCount * 30; // 1 KM po danu za 30 dana
                const discountMonthly = logReferredTrucks * 15; // 0.50 KM po danu = 15 KM po kamionu
                const finalMonthly = Math.max(0, baseMonthly - discountMonthly);
                const isFree = baseMonthly > 0 && finalMonthly === 0;

                return (
                  <div
                    style={{
                      background: isFree ? "#064e3b" : "#111827",
                      border: isFree ? "1px solid #059669" : "1px solid #374151",
                      borderRadius: 6,
                      padding: 16,
                      marginTop: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#cbd5e1" }}>
                      <span>Osnovni zakup ({logTrucksCount} kamiona × 30 KM):</span>
                      <strong style={{ color: "#f8fafc" }}>{formatMoneyBiH(baseMonthly, "KM")}</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#38bdf8", marginTop: 6 }}>
                      <span>Referral popust ({logReferredTrucks} kamiona × 15 KM):</span>
                      <strong>- {formatMoneyBiH(discountMonthly, "KM")}</strong>
                    </div>

                    <div style={{ height: 1, background: "#374151", margin: "10px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                        Konačna mjesečna pretplata:
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: isFree ? "#34d399" : "#f8fafc" }}>
                        {isFree ? "0,00 KM (BESPLATNO!)" : formatMoneyBiH(finalMonthly, "KM")}
                      </span>
                    </div>

                    {isFree && (
                      <div style={{ fontSize: 11.5, color: "#a7f3d0", marginTop: 6 }}>
                        ✓ Klijent ima 100% besplatno korištenje LogistiX-a dok god su preporučeni klijenti aktivni!
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                style={btnDesktopPrimary}
                onClick={() => setLogisticxOpen(false)}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: PRO-RATA KALKULATOR */}
      {proRataOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
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
              background: "#18202c",
              border: "1px solid #374151",
              borderRadius: 6,
              padding: 24,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2d3748", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                ⚡ Hetzner Pro-Rata Obračun
              </h3>
              <button
                type="button"
                onClick={() => setProRataOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
              Računa tačan iznos od dana početka do 1. u narednom mjesecu (srazmjerno broju dana).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5 }}>
                  Mjesečna ugovorena cijena zakupa:
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    value={proRataPrice}
                    onChange={(e) => setProRataPrice(Number(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 4,
                      color: "#f8fafc",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                  <select
                    value={proRataCurrency}
                    onChange={(e) => setProRataCurrency(e.target.value)}
                    style={{
                      width: 80,
                      padding: "7px",
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 4,
                      color: "#f8fafc",
                    }}
                  >
                    <option value="KM">KM</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 5 }}>
                  Datum početka zakupa:
                </label>
                <input
                  type="date"
                  value={proRataDate}
                  onChange={(e) => setProRataDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 4,
                    color: "#f8fafc",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 11.5, color: "#38bdf8", fontWeight: 700 }}>
                  Obračun do 01.{formatDateBiH(proRataResult.nextFirstOfMonthFormatted).slice(3)}:
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 12.5, color: "#94a3b8" }}>
                    Preostalo dana ({proRataResult.daysRemaining} od {proRataResult.daysInMonth}):
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8" }}>
                    {formatMoneyBiH(proRataResult.proRataAmount, proRataCurrency)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  Formula: ({formatMoneyBiH(proRataPrice, proRataCurrency)} / {proRataResult.daysInMonth} dana) × {proRataResult.daysRemaining} dana
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button
                type="button"
                style={btnDesktopPrimary}
                onClick={() => setProRataOpen(false)}
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: SPECIFIKACIJA RAČUNA ZA ZAKUP LICENCE */}
      {invoiceModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
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
              background: "#18202c",
              border: "1px solid #374151",
              borderRadius: 6,
              padding: 24,
              width: "100%",
              maxWidth: 560,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2d3748", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                🧾 Specifikacija Računa Pretplate
              </h3>
              <button
                type="button"
                onClick={() => setInvoiceModalTenant(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 12, background: "#111827", borderRadius: 4, border: "1px solid #2d3748" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Tenant & CRM Klijent:</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", marginTop: 2 }}>
                  {invoiceModalTenant.naziv} ({invoiceModalTenant.klijent_naziv})
                </div>
                {invoiceModalTenant.klijent_jib && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    JIB: {invoiceModalTenant.klijent_jib} · {invoiceModalTenant.klijent_is_ino ? "INO klijent (0% PDV, stopa K)" : "Domaće pravno lice"}
                  </div>
                )}
                {invoiceModalTenant.klijent_email && (
                  <div style={{ fontSize: 12, color: "#38bdf8", marginTop: 2 }}>
                    Email za fakturu: {invoiceModalTenant.klijent_email}
                  </div>
                )}
              </div>

              <div style={{ padding: 12, background: "#111827", borderRadius: 4, border: "1px solid #2d3748" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase" }}>Stavka za fakturisanje:</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#38bdf8", marginTop: 2 }}>
                  Zakup softverske licence ({invoiceModalTenant.product_display_name})
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
                  Opis: <em>Zakup softverske licence za period {invoiceModalTenant.billing.billingPeriodDescription}</em>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginTop: 6 }}>
                  Iznos: {formatMoneyBiH(invoiceModalTenant.monthly_price, invoiceModalTenant.currency || "KM")}
                </div>
              </div>

              <div style={{ padding: 10, background: "#221c10", borderRadius: 4, border: "1px solid #b45309" }}>
                <div style={{ fontSize: 11.5, color: "#fbbf24", fontWeight: 700 }}>
                  ⚖️ Fiskalizacija i bankovni izvod:
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 3, lineHeight: 1.4 }}>
                  Fiskalna faktura sa QR kodom generiše se u radno vrijeme nakon knjiženja bankovnog izvoda. Klijent dobija elektronsku potvrdu na email sa kontaktom <strong>{BILLING_CONTACT_EMAIL}</strong>.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <Link
                href="/fakture/wizard"
                style={btnDesktopPrimary}
              >
                Kreiraj Fakturu u Wizardu ➔
              </Link>

              <button
                type="button"
                style={btnDesktop}
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
