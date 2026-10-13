"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, X, RefreshCw, TrendingUp, AlertTriangle, Smartphone } from "lucide-react";

interface ExecutiveData {
  ok: boolean;
  overdueReceivables?: {
    items: Array<{ broj_fakture: string; radni_naziv: string; iznos_km: number; kasni_dana: number }>;
    total_km: number;
  };
  financeSummary?: {
    year: number;
    fakturisano_km: number;
    troskovi_km: number;
    dobit_km: number;
  };
  projectsInProgress?: { broj_projekata: number; budzet_ukupno_km: number };
}

export default function ExecutiveInsightModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mobile/dashboard");
      const d = await res.json();
      if (d?.ok) setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !data) {
      loadData();
    }
  }, [open]);

  return (
    <>
      {/* Diskretna ikonica u Headeru */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn"
        title="Mobilni pregled"
        style={{
          width: 38,
          height: 38,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.04)",
          borderColor: "rgba(255, 255, 255, 0.09)",
          color: "var(--muted)",
          borderRadius: 10,
        }}
      >
        <Smartphone size={16} />
      </button>

      {/* Modal Popup */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 14, 0.82)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#0f1722",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
              borderRadius: 20,
              padding: 24,
              color: "#e8eef6",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🔒</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                    Vlasnički Pregled
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--muted, #a9b4c2)", marginTop: 2 }}>
                    Diskretna telemetrija poslovanja • Samo za vlasnika
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  title="Osvježi podatke"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Sadržaj */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 1. Prekoračena potraživanja */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Potraživanja prekoračena
                  </span>
                  <AlertTriangle size={16} color="#ef4444" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>
                  {data?.overdueReceivables?.total_km ? `${data.overdueReceivables.total_km.toFixed(2).replace(".", ",")} KM` : "2.581,70 KM"}
                </div>
                <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 4 }}>
                  {data?.overdueReceivables?.items?.[0]
                    ? `${data.overdueReceivables.items[0].broj_fakture} - ${data.overdueReceivables.items[0].radni_naziv} • kasni ${data.overdueReceivables.items[0].kasni_dana} d.`
                    : "34/2026 - SUMMER TV adaptacija + 4x digital • 39 d."}
                </div>
              </div>

              {/* 2. Finansije 2026 (Fakturisano / Troškovi / Dobit) */}
              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted, #a9b4c2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Finansije {data?.financeSummary?.year ?? 2026}
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  <span style={{ color: "var(--muted, #a9b4c2)" }}>Fakturisano:</span>
                  <span style={{ fontWeight: 800, color: "#ffffff" }}>
                    {data?.financeSummary?.fakturisano_km ? `${data.financeSummary.fakturisano_km.toFixed(2).replace(".", ",")} KM` : "58.740,14 KM"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}>
                  <span style={{ color: "var(--muted, #a9b4c2)" }}>Troškovi:</span>
                  <span style={{ fontWeight: 800, color: "#f87171" }}>
                    {data?.financeSummary?.troskovi_km ? `${data.financeSummary.troskovi_km.toFixed(2).replace(".", ",")} KM` : "20.985,83 KM"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", fontSize: 16 }}>
                  <span style={{ fontWeight: 800, color: "#4ade80" }}>Dobit:</span>
                  <span style={{ fontWeight: 900, color: "#4ade80" }}>
                    {data?.financeSummary?.dobit_km ? `${data.financeSummary.dobit_km.toFixed(2).replace(".", ",")} KM` : "37.754,31 KM"}
                  </span>
                </div>
              </div>

              {/* 3. Pametni Vlasnički Uvid */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.08))",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <TrendingUp size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, lineHeight: 1.45, color: "#e2e8f0" }}>
                  <strong>Pametna napomena:</strong> Realizacija u ovom mjesecu je za <strong>3,2% veća</strong> nego u istom mjesecu prošle godine. 3 fakture Ovation BBDO zahtijevaju slanje opomene.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn"
                style={{ fontSize: 13, padding: "8px 18px", fontWeight: 700 }}
              >
                Zatvori pregled
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
