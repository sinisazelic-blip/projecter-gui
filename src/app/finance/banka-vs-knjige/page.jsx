"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

const fmtKM = (v) => {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} KM`;
};

const fmtDate = (s) => {
  if (s == null || s === "") return "—";
  const part = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return String(s);
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
};

export default function BankaVsKnjigePage() {
  const { t } = useTranslation();
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("to", toDate);
    if (fromDate) params.set("from", fromDate);
    fetch(`/api/finance/banka-vs-knjige?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "Greška");
        setData(j);
      })
      .catch((e) => {
        if (alive) setError(e?.message ?? "Greška učitavanja");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [toDate, fromDate]);

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("bankaVsKnjige.title")}</div>
                  <div className="brandSub">{t("bankaVsKnjige.subtitle")}</div>
                </div>
              </div>
              <Link href="/finance" className="btn" title={t("finance.title")}>
                ← {t("finance.title")}
              </Link>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>Stanje do datuma</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input"
                  style={{ padding: "8px 12px" }}
                />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>Od (opciono, za promet)</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input"
                  style={{ padding: "8px 12px" }}
                  placeholder="prazno = samo stanje"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: "var(--bad)", marginBottom: 16 }}>
              <div style={{ color: "var(--bad)" }}>{error}</div>
            </div>
          )}

          {loading && (
            <div className="card">
              <div className="muted">Učitavanje…</div>
            </div>
          )}

          {!loading && data && (
            <>
              <div
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Stanje po banki (do {fmtDate(data.to_date)})</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtKM(data.stanje_banke_km)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Stanje po knjigama</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtKM(data.stanje_knjige_km)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Prihodi {fmtKM(data.suma_prihodi_km)} − Plaćanja {fmtKM(data.suma_placanja_km)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Razlika</div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: data.u_ravnotezi ? "var(--good)" : "var(--warn)",
                    }}
                  >
                    {fmtKM(data.razlika_km)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {data.u_ravnotezi ? "✓ U ravnoteži" : "Razlika – provjeri linkovanje i unose"}
                  </div>
                </div>
              </div>

              {data.promet_u_periodu && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Promet u periodu {fmtDate(data.from_date)} – {fmtDate(data.to_date)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    <span>Banka (promet): {fmtKM(data.promet_u_periodu.banka_km)}</span>
                    <span>Prihodi: {fmtKM(data.promet_u_periodu.prihodi_km)}</span>
                    <span>Plaćanja: {fmtKM(data.promet_u_periodu.placanja_km)}</span>
                    <span>Knjige (neto): {fmtKM(data.promet_u_periodu.knjige_neto_km)}</span>
                  </div>
                </div>
              )}

              <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="subtle" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Stanje po banki = zbroj svih transakcija iz importa izvoda (bank_tx_posting) do odabranog datuma. EUR preračunato po 1,95 KM.
                  Stanje po knjigama = suma prihoda (projektni_prihodi) − suma plaćanja (placanja) do istog datuma. Ako se razlika približava nuli, evidencija je usklađena.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
