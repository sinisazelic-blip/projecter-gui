"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";

interface FiskalZReportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FiskalZReportModal({ open, onClose }: FiskalZReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [zReportResult, setZReportResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadData();
      setZReportResult(null);
      setError(null);
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fakture/z-izvjestaj");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || "Nije uspjelo učitavanje podataka");
      }
    } catch (err: any) {
      setError("Greška pri učitavanju: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!confirm("Da li ste sigurni da želite ZAKLJUČITI smjenu i generisati Dnevni (Z) izvještaj na fiskalnom uređaju?")) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/fakture/z-izvjestaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok && json.report) {
        setZReportResult(json.report);
      } else {
        setError(json.error || "Nije uspjelo zaključenje smjene");
      }
    } catch (err: any) {
      setError("Greška: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dnevni (Z) Izvještaj & Zaključenje Smjene"
      subtitle="Fiskalni Z-izvještaj i zatvaranje smjene na LPFR uređaju"
      width={780}
      icon="/fluxa/Icon.ico"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#666" }}>
            {data?.lpfrOnline ? "🟢 LPFR Uređaj je ONLINE" : "🟡 LPFR Uređaj nije detektovan na mreži"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {zReportResult && (
              <button type="button" className="btn" onClick={handlePrint}>
                🖨️ Štampaj Z-Izvještaj
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Zatvori
            </button>
            {!zReportResult && (
              <button
                type="button"
                className="btn primary"
                onClick={handleCloseShift}
                disabled={submitting || loading}
                style={{ backgroundColor: "#10b981", borderColor: "#059669", color: "#fff", fontWeight: "bold" }}
              >
                {submitting ? "Zaključujem smjenu..." : "✅ Zaključi Smjenu (Z-Izvještaj)"}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ padding: "10px 0" }}>
        {error && (
          <div style={{ padding: 12, marginBottom: 14, backgroundColor: "#fee2e2", border: "1px solid #f87171", borderRadius: 8, color: "#991b1b", fontSize: 13, fontWeight: "bold" }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#666" }}>
            ⏳ Učitavanje stanja fiskalnog uređaja i današnjih faktura...
          </div>
        ) : zReportResult ? (
          <div style={{ backgroundColor: "#f0fdf4", border: "2px solid #86efac", borderRadius: 12, padding: 20 }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #15803d", paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#166534", fontSize: 18 }}>══ DNEVNI (Z) FISKALNI IZVJEŠTAJ ══</h3>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                Z-Broj: <strong>#{zReportResult.zBroj}</strong> | Datum i vrijeme: <strong>{zReportResult.datum}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 14 }}>
              <div>
                <strong>Firma:</strong> {zReportResult.firmaNaziv}<br />
                <strong>JIB:</strong> {zReportResult.jib} | <strong>PIB:</strong> {zReportResult.pib}<br />
                <strong>Adresa:</strong> {zReportResult.adresa}
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>Broj fiskalizovanih faktura:</strong> {zReportResult.fiskalizovanoKomada} kom<br />
                <strong>Status LPFR:</strong> {zReportResult.lpfrSuccess ? "✓ Evidentirano na LPFR" : "Lokalno zaključeno"}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", border: "1px solid #bbf7d0", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>Ukupan promet bez PDV:</span>
                <strong>{Number(zReportResult.ukupnoBezPdv).toFixed(2)} KM</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>Iznos PDV (17%):</span>
                <strong>{Number(zReportResult.ukupnoPdv).toFixed(2)} KM</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "2px solid #166534", fontSize: 16, color: "#166534" }}>
                <strong>UKUPAN PROMET SA PDV:</strong>
                <strong>{Number(zReportResult.ukupnoSaPdv).toFixed(2)} KM</strong>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#15803d", textAlign: "center" }}>
              ✓ Smjena je uspješno zaključena i evidentirana u bazi i fiskalnom sistemu.
            </div>
          </div>
        ) : (
          <div>
            {/* Status Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Fiskalni Uređaj</div>
                <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: data?.lpfrOnline ? "#16a34a" : "#dc2626" }}>
                  {data?.lpfrOnline ? "🟢 LPFR Dostupan" : "🔴 Nije dostupan"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{data?.lpfrUrl || "Nije podešeno"}</div>
              </div>

              <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>PIN / Autentifikacija</div>
                <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: data?.pinConfigured ? "#16a34a" : "#ea580c" }}>
                  {data?.pinConfigured ? "✓ PIN Konfigurisan" : "⚠️ PIN Nedostaje"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Automatski prenos u zaglavljima</div>
              </div>

              <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Faktura Danas</div>
                <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: "#0f172a" }}>
                  {data?.ukupnoFaktura || 0} faktura ({data?.fiskalizovanoKomada || 0} fisk.)
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Za obračunski period</div>
              </div>
            </div>

            {/* Financial totals banner */}
            <div style={{ backgroundColor: "#f1f5f9", border: "2px solid #cbd5e1", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: "bold", textTransform: "uppercase", marginBottom: 8 }}>
                Finansijski Presjek Prometa za Današnji Dan:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Osnovica:</span>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#0f172a" }}>{Number(data?.ukupnoBezPdv || 0).toFixed(2)} KM</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>PDV (17%):</span>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#0f172a" }}>{Number(data?.ukupnoPdv || 0).toFixed(2)} KM</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Ukupno sa PDV:</span>
                  <div style={{ fontSize: 20, fontWeight: "900", color: "#16a34a" }}>{Number(data?.ukupnoSaPdv || 0).toFixed(2)} KM</div>
                </div>
              </div>
            </div>

            {/* Invoices list preview */}
            {data?.fakture && data.fakture.length > 0 ? (
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>Broj Fakture</th>
                      <th style={{ padding: "6px 10px", textAlign: "center" }}>PFR Broj</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>Iznos (KM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fakture.map((f: any) => (
                      <tr key={f.faktura_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px", fontWeight: "bold" }}>{f.broj_fakture}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>{f.broj_fiskalni || "—"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "bold" }}>{Number(f.iznos_ukupno_km).toFixed(2)} KM</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 16, color: "#94a3b8", fontSize: 12, backgroundColor: "#f8fafc", borderRadius: 8 }}>
                Nema novih izdatih faktura za tekući period.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
