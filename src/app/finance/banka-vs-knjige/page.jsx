"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import FluxaLogo from "@/components/FluxaLogo";
import { useTranslation } from "@/components/LocaleProvider";

const fmtAmount = (v, suffix) => {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}${suffix}`;
};

const fmtDate = (s) => {
  if (s == null || s === "") return "—";
  const part = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return String(s);
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
};

export default function BankaVsKnjigePage() {
  const { t, locale } = useTranslation();
  const ccySuffix = t("common.currencySuffix") || (locale === "en" ? " EUR" : " KM");
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
        if (!j.ok) throw new Error(j.error || t("common.error"));
        setData(j);
      })
      .catch((e) => {
        if (alive) setError(e?.message ?? t("common.errorLoad"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [toDate, fromDate, t]);

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
                <label className="label" style={{ display: "block", marginBottom: 4 }}>{t("bankaVsKnjige.toDateLabel")}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input"
                  style={{ padding: "8px 12px" }}
                />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4 }}>{t("bankaVsKnjige.fromDateLabel")}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input"
                  style={{ padding: "8px 12px" }}
                  placeholder={t("bankaVsKnjige.fromPlaceholder")}
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
              <div className="muted">{t("bankaVsKnjige.loading")}</div>
            </div>
          )}

          {!loading && data && (
            <>
              {/* GLAVNE KARTICE */}
              <div
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>🏦 Bankovni saldo (do {fmtDate(data.to_date)})</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtAmount(data.stanje_banke_km, ccySuffix)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Prilivi: <span style={{ color: "#4ade80" }}>+{fmtAmount(data.banka_prilivi_km, ccySuffix)}</span> · Odlivi: <span style={{ color: "#f87171" }}>-{fmtAmount(data.banka_odlivi_km, ccySuffix)}</span>
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>📄 Fakturisano kupcima</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8" }}>{fmtAmount(data.fakturisano_km, ccySuffix)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Ukupno izdate izlazne fakture u sistemu
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>📦 KUF troškovi dobavljača</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>{fmtAmount(data.kuf_troskovi_km, ccySuffix)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Evidentirane ulazne fakture i fiksne obaveze
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>💳 Kreditne obaveze ({data.kredit_naziv || "EKI"})</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fb923c" }}>{fmtAmount(data.kredit_obaveze_km, ccySuffix)}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Preostali dug aktivnog poslovnog kredita
                  </div>
                </div>
              </div>

              {/* REKONCILIJACIJA & NEALOCIRANO */}
              <div
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                  background: data.u_ravnotezi ? "rgba(16,185,129,0.05)" : "rgba(234,179,8,0.05)",
                  border: data.u_ravnotezi ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(234,179,8,0.3)",
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    ⏳ Nealocirani prilivi (čekaju vezu na fakturu)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: data.nealocirani_prilivi_km > 0 ? "#fbbf24" : "inherit" }}>
                    {fmtAmount(data.nealocirani_prilivi_km, ccySuffix)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {data.nealocirani_prilivi_km > 0 ? "Potrebno povezati uplate sa izlaznim računima" : "Svi prilivi su uspješno povezani"}
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    ⏳ Nealocirani odlivi (čekaju vezu na KUF)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: data.nealocirani_odlivi_km > 0 ? "#fbbf24" : "inherit" }}>
                    {fmtAmount(data.nealocirani_odlivi_km, ccySuffix)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {data.nealocirani_odlivi_km > 0 ? "Potrebno povezati isplate sa ulaznim računima" : "Svi odlivi su uspješno povezani"}
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    🎯 Status usklađenosti izvoda i knjiga
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: data.u_ravnotezi ? "#4ade80" : "#fbbf24" }}>
                    {data.u_ravnotezi ? "✅ Potpuno usklađeno (100%)" : "⚠️ Potrebna alokacija stavki"}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Automatsko praćenje bankovnih izvoda i knjiženja
                  </div>
                </div>
              </div>

              {data.promet_u_periodu && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    Promet u periodu ({fmtDate(data.from_date)} – {fmtDate(data.to_date)})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                    <span>🏦 Banka neto: <b>{fmtAmount(data.promet_u_periodu.banka_neto_km, ccySuffix)}</b></span>
                    <span>📄 Fakturisano: <b>{fmtAmount(data.promet_u_periodu.fakturisano_km, ccySuffix)}</b></span>
                    <span>📦 KUF troškovi: <b>{fmtAmount(data.promet_u_periodu.kuf_troskovi_km, ccySuffix)}</b></span>
                  </div>
                </div>
              )}

              <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="subtle" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  💡 Modul Banka vs Knjige služi za verifikaciju da su sve uplate i isplate sa poslovnog bankovnog računa Studio TAF uredno proknjižene i povezane sa izdatim računima (prihodi) i primljenim računima dobavljača (KUF), uz transparentan uvid u stanje kredita.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
