"use client";

import React, { useEffect, useState } from "react";

const MJESECI_NAZIVI = [
  "Januar", "Februar", "Mart", "April", "Maj", "Juni",
  "Juli", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"
];

const TRACKED_SERVICES = [
  { id: 20, naziv: "Knjigovodstveni Biro", opis: "Paušalni ugovor 150 KM/mj (bez pojedinačnih faktura)", iznos: 150, icon: "📑" },
  { id: 27, naziv: "Paušal Poreza na Dobit (PURS)", opis: "Mjesečna akontacija poreza na dobit prema PURS (100 KM/mj)", iznos: 100, icon: "🏛️" },
];

export default function RacunovodstvoTrackerCard() {
  const [selectedTrosakId, setSelectedTrosakId] = useState<number>(20);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [godina, setGodina] = useState(2026);
  const [uplataIznos, setUplataIznos] = useState("300");
  const [showUplataModal, setShowUplataModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentService = TRACKED_SERVICES.find((s) => s.id === selectedTrosakId) || TRACKED_SERVICES[0];

  async function loadTracker() {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/ugovorne-obaveze?trosak_id=${selectedTrosakId}&godina=${godina}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (e) {
      console.error("Greška pri učitavanju praćenja ugovornih obaveza:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTracker();
  }, [selectedTrosakId, godina]);

  async function handleAutoAllocate(e: React.FormEvent) {
    e.preventDefault();
    const iznos = Number(uplataIznos);
    if (!iznos || iznos <= 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/ugovorne-obaveze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trosak_id: selectedTrosakId,
          uplata_km: iznos,
          datum_uplate: new Date().toISOString().slice(0, 10),
          napomena: `Uplata preko izvoda ${iznos} KM`,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowUplataModal(false);
        loadTracker();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const stats = data?.stats || {};
  const zadnjiMjesecNaziv = stats.zadnjiPlaceniMjesec > 0 ? MJESECI_NAZIVI[stats.zadnjiPlaceniMjesec - 1] : "Nema uplata";

  return (
    <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 14, padding: 20, marginBottom: 25, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35)" }}>
      {/* SERVICE SELECTOR TABS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12, flexWrap: "wrap" }}>
        {TRACKED_SERVICES.map((srv) => (
          <button
            key={srv.id}
            type="button"
            onClick={() => {
              setSelectedTrosakId(srv.id);
              setUplataIznos(String(srv.iznos * 2));
            }}
            style={{
              background: selectedTrosakId === srv.id ? "rgba(56, 189, 248, 0.25)" : "rgba(30, 41, 59, 0.5)",
              color: selectedTrosakId === srv.id ? "#38bdf8" : "#94a3b8",
              border: selectedTrosakId === srv.id ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
              padding: "8px 16px",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{srv.icon}</span> {srv.naziv} ({srv.iznos} KM/mj)
          </button>
        ))}
      </div>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>{currentService.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: "#f8fafc", fontWeight: 800 }}>
              {currentService.naziv} ({currentService.iznos} KM / mj)
            </h3>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
              {currentService.opis}
            </div>
          </div>
        </div>

        {/* STATUS BADGES */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ background: stats.zadnjiPlaceniMjesec > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", border: stats.zadnjiPlaceniMjesec > 0 ? "1px solid #10b981" : "1px solid #ef4444", padding: "6px 14px", borderRadius: 8, textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Pokriveno do</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: stats.zadnjiPlaceniMjesec > 0 ? "#10b981" : "#ef4444" }}>
              {stats.zadnjiPlaceniMjesec > 0 ? `✅ ${zadnjiMjesecNaziv} ${godina}.` : "Nema uplata"}
            </div>
          </div>

          <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", padding: "6px 14px", borderRadius: 8, textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Preostalo za {godina}.</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#f59e0b" }}>
              {stats.preostaloZaGodinuKm || 0} KM ({stats.preostaloMjeseci || 0} mj)
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowUplataModal(true)}
            style={{
              background: "#0284c7",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Rasknjiži Uplatu ({currentService.iznos * 2} KM)
          </button>
        </div>
      </div>

      {/* 12-MONTH GRID */}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center", color: "#94a3b8" }}>Učitavanje podataka...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginTop: 16 }}>
          {(data?.months || []).map((m: any) => {
            const isPaid = m.status === "PLACENO";
            const nazivMjeseca = MJESECI_NAZIVI[m.mjesec - 1];

            return (
              <div
                key={m.id}
                style={{
                  background: isPaid ? "rgba(16, 185, 129, 0.12)" : "rgba(30, 41, 59, 0.5)",
                  border: isPaid ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 80,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isPaid ? "#34d399" : "#f1f5f9" }}>
                    {nazivMjeseca}
                  </span>
                  <span style={{ fontSize: 14 }}>{isPaid ? "✅" : "⏳"}</span>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isPaid ? "#10b981" : "#94a3b8" }}>
                    {Number(m.iznos_km).toFixed(2)} KM
                  </div>
                  <div style={{ fontSize: 10, color: isPaid ? "#6ee7b7" : "#64748b", marginTop: 2 }}>
                    {isPaid ? (m.datum_placanja ? String(m.datum_placanja).slice(0, 10) : "Plaćeno") : "Čeka uplatu"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL ZA RASKNJIŽAVANJE UPLATE */}
      {showUplataModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 12, padding: 24, width: 440, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 14px", color: "#f8fafc" }}>
              Rasknjižavanje Uplate: {currentService.naziv}
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px" }}>
              Unesite uplaćeni iznos sa izvoda (npr. {currentService.iznos}, {currentService.iznos * 2}, {currentService.iznos * 4} KM). Sistem će automatski FIFO zatvoriti najstarije neplaćene mjesece.
            </p>

            <form onSubmit={handleAutoAllocate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>Iznos Uplate (KM)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={uplataIznos}
                  onChange={(e) => setUplataIznos(e.target.value)}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", padding: "10px", borderRadius: 6, color: "#fff", fontSize: 16, fontWeight: 700, marginTop: 4 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowUplataModal(false)}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#cbd5e1", padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
                >
                  {submitting ? "Rasknjižavam..." : "Potvrdi i Rasporedi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
