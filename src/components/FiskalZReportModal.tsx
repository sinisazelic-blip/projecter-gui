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
    if (!confirm("Da li ste sigurni da želite ZAKLJUČITI smjenu i generisati Dnevni (Z) izvještaj?")) {
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
    <>
      {/* Global CSS for Print and High-Contrast Modal Styling */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Sakrij sve ostalo na stranici */
          body * {
            visibility: hidden !important;
          }
          /* Prikaži samo službeni A4 dokument za štampu */
          .printable-z-report-document,
          .printable-z-report-document * {
            visibility: visible !important;
          }
          .printable-z-report-document {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 20px !important;
          }
        }
        @media screen {
          .printable-z-report-document {
            display: none !important;
          }
        }
      `}</style>

      {/* Službeni A4 dokument za štampu (aktivan samo pri window.print()) */}
      {zReportResult && (
        <div className="printable-z-report-document" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#000", lineHeight: "1.5" }}>
          <div style={{ borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", textTransform: "uppercase" }}>{zReportResult.firmaNaziv}</h2>
                <div>JIB: {zReportResult.jib} | PIB: {zReportResult.pib}</div>
                <div>Adresa: {zReportResult.adresa}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>DNEVNI FISKALNI (Z) IZVJEŠTAJ</h3>
                <div>Z-Broj: <strong>#{zReportResult.zBroj}</strong></div>
                <div>Datum i vrijeme: <strong>{zReportResult.datum}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", textTransform: "uppercase", borderBottom: "1px solid #ccc", paddingBottom: "4px" }}>
              Specifikacija Izdatih Faktura / Računa
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #000", backgroundColor: "#f3f4f6" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>#</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Broj Fakture</th>
                  <th style={{ padding: "6px 8px", textAlign: "center" }}>PFR Broj</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Klijent / Naručilac</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Iznos (Valuta)</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Fiskalni BAM Iznos</th>
                </tr>
              </thead>
              <tbody>
                {zReportResult.fakture && zReportResult.fakture.length > 0 ? (
                  zReportResult.fakture.map((f: any, idx: number) => (
                    <tr key={f.faktura_id || idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "6px 8px" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 8px", fontWeight: "bold" }}>{f.broj_fakture}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{f.broj_fiskalni || "—"}</td>
                      <td style={{ padding: "6px 8px" }}>{f.naziv_klijenta || "—"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {f.valuta === "EUR" ? `${Number(f.iznos_nominal || f.iznos_ukupno_km).toFixed(2)} EUR` : `${Number(f.iznos_nominal || f.iznos_ukupno_km).toFixed(2)} KM`}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>
                        {Number(f.iznos_bam || (Number(f.iznos_ukupno_km) * (f.valuta === "EUR" ? 1.95583 : 1))).toFixed(2)} KM
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: "10px", textAlign: "center" }}>Nema zabilježenih faktura za tekući period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Finansijska Rekapitulacija */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
            <div style={{ width: "320px", border: "1.5px solid #000", padding: "12px", backgroundColor: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
                <span>Ukupan promet bez PDV:</span>
                <strong>{Number(zReportResult.ukupnoBezPdv).toFixed(2)} KM</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e5e7eb" }}>
                <span>Iznos PDV (17%):</span>
                <strong>{Number(zReportResult.ukupnoPdv).toFixed(2)} KM</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px", fontWeight: "bold" }}>
                <span>UKUPAN PROMET SA PDV:</span>
                <span>{Number(zReportResult.ukupnoSaPdv).toFixed(2)} KM</span>
              </div>
            </div>
          </div>

          {/* Potpisi */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "50px", paddingTop: "20px" }}>
            <div style={{ textAlign: "center", width: "200px", borderTop: "1px dashed #000", paddingTop: "6px" }}>
              Blagajnik / Operater
            </div>
            <div style={{ textAlign: "center", width: "200px", borderTop: "1px dashed #000", paddingTop: "6px" }}>
              Odgovorno lice / M.P.
            </div>
          </div>
        </div>
      )}

      {/* Modal na ekranu */}
      <Modal
        open={open}
        onClose={onClose}
        title="Dnevni (Z) Izvještaj & Zaključenje Smjene"
        subtitle="Fiskalni Z-izvještaj i zatvaranje smjene na LPFR uređaju"
        width={780}
        icon="/fluxa/Icon.ico"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: data?.lpfrOnline ? "#10b981" : "#f59e0b", fontWeight: "bold" }}>
              {data?.lpfrOnline ? "🟢 LPFR Uređaj je ONLINE" : "🟡 LPFR Uređaj nije detektovan na mreži"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {zReportResult && (
                <button type="button" className="btn" onClick={handlePrint} style={{ fontWeight: "bold", backgroundColor: "#2563eb", color: "#fff", borderColor: "#1d4ed8" }}>
                  🖨️ Štampaj Z-Dokument (A4)
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
            <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
              ⏳ Učitavanje stanja fiskalnog uređaja i današnjih faktura...
            </div>
          ) : zReportResult ? (
            <div style={{ backgroundColor: "#064e3b", border: "2px solid #34d399", borderRadius: 12, padding: 20, color: "#f0fdf4" }}>
              <div style={{ textAlign: "center", borderBottom: "2px solid #34d399", paddingBottom: 10, marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: "#ffffff", fontSize: 18, fontWeight: "900", letterSpacing: "1px" }}>══ DNEVNI (Z) FISKALNI IZVJEŠTAJ ══</h3>
                <div style={{ fontSize: 13, color: "#a7f3d0", marginTop: 4 }}>
                  Z-Broj: <strong style={{ color: "#ffffff" }}>#{zReportResult.zBroj}</strong> | Datum i vrijeme: <strong style={{ color: "#ffffff" }}>{zReportResult.datum}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 14, color: "#e2e8f0" }}>
                <div>
                  <strong style={{ color: "#ffffff" }}>Firma:</strong> {zReportResult.firmaNaziv}<br />
                  <strong style={{ color: "#ffffff" }}>JIB:</strong> {zReportResult.jib} | <strong style={{ color: "#ffffff" }}>PIB:</strong> {zReportResult.pib}<br />
                  <strong style={{ color: "#ffffff" }}>Adresa:</strong> {zReportResult.adresa}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ color: "#ffffff" }}>Broj fiskalizovanih faktura:</strong> {zReportResult.fiskalizovanoKomada} kom<br />
                  <strong style={{ color: "#ffffff" }}>Status LPFR:</strong> {zReportResult.lpfrSuccess ? "✓ Evidentirano na LPFR" : "Evidentirano u Fluxa sistemu"}
                </div>
              </div>

              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 14, color: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#cbd5e1" }}>
                  <span>Ukupan promet bez PDV:</span>
                  <strong style={{ color: "#ffffff" }}>{Number(zReportResult.ukupnoBezPdv).toFixed(2)} KM</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#cbd5e1" }}>
                  <span>Iznos PDV (17%):</span>
                  <strong style={{ color: "#ffffff" }}>{Number(zReportResult.ukupnoPdv).toFixed(2)} KM</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "2px solid #34d399", fontSize: 16, color: "#34d399" }}>
                  <strong style={{ color: "#34d399" }}>UKUPAN PROMET SA PDV:</strong>
                  <strong style={{ color: "#34d399", fontSize: "18px" }}>{Number(zReportResult.ukupnoSaPdv).toFixed(2)} KM</strong>
                </div>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, color: "#a7f3d0", textAlign: "center" }}>
                ✓ Smjena je uspješno zaključena i evidentirana u bazi i fiskalnom sistemu.
              </div>
            </div>
          ) : (
            <div>
              {/* Status Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: "bold" }}>Fiskalni Uređaj</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: data?.lpfrOnline ? "#10b981" : "#ef4444" }}>
                    {data?.lpfrOnline ? "🟢 LPFR Dostupan" : "🔴 Nije dostupan"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{data?.lpfrUrl || "Nije podešeno"}</div>
                </div>

                <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: "bold" }}>PIN / Autentifikacija</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: data?.pinConfigured ? "#10b981" : "#f97316" }}>
                    {data?.pinConfigured ? "✓ PIN Konfigurisan" : "⚠️ PIN Nedostaje"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Automatski prenos u zaglavljima</div>
                </div>

                <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: "bold" }}>Faktura Danas</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4, color: "#f8fafc" }}>
                    {data?.ukupnoFaktura || 0} faktura ({data?.fiskalizovanoKomada || 0} fisk.)
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Za obračunski period</div>
                </div>
              </div>

              {/* Financial totals banner */}
              <div style={{ backgroundColor: "#0f172a", border: "2px solid #334155", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: "bold", textTransform: "uppercase", marginBottom: 8 }}>
                  Finansijski Presjek Prometa za Današnji Dan (Fiskalni LPFR iznosi):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Osnovica (KM):</span>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#f8fafc" }}>{Number(data?.ukupnoBezPdv || 0).toFixed(2)} KM</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>PDV (17%):</span>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#f8fafc" }}>{Number(data?.ukupnoPdv || 0).toFixed(2)} KM</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Ukupno sa PDV (PFR):</span>
                    <div style={{ fontSize: 20, fontWeight: "900", color: "#34d399" }}>{Number(data?.ukupnoSaPdv || 0).toFixed(2)} KM</div>
                  </div>
                </div>
              </div>

              {/* Invoices list preview */}
              {data?.fakture && data.fakture.length > 0 ? (
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #334155", borderRadius: 8, backgroundColor: "#0f172a" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#1e293b", borderBottom: "1px solid #334155" }}>
                      <tr>
                        <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8" }}>Broj Fakture</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", color: "#94a3b8" }}>PFR Broj</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8" }}>Iznos Fakture (Fiskalni BAM ekvivalent)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fakture.map((f: any) => (
                        <tr key={f.faktura_id} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px 10px", fontWeight: "bold", color: "#f8fafc" }}>{f.broj_fakture}</td>
                          <td style={{ padding: "8px 10px", textAlign: "center", color: "#cbd5e1" }}>{f.broj_fiskalni || "—"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "bold", color: "#34d399" }}>
                            {f.display_iznos || (f.valuta === "EUR" ? `${Number(f.iznos_ukupno_km).toFixed(2)} EUR (${(Number(f.iznos_ukupno_km) * 1.95583).toFixed(2)} KM)` : `${Number(f.iznos_ukupno_km).toFixed(2)} KM`)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 16, color: "#64748b", fontSize: 12, backgroundColor: "#1e293b", borderRadius: 8 }}>
                  Nema novih izdatih faktura za tekući period.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
