"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Dashboard = {
  ok: boolean;
  error?: string;
  overduePayables?: { items: { title: string; iznos_km: number; kasni_dana: number }[]; total_km: number };
  overdueReceivables?: { items: { broj_fakture: string; radni_naziv: string; iznos_km: number; kasni_dana: number }[]; total_km: number };
  financeSummary?: { year: number; fakturisano_km: number; troskovi_km: number; dobit_km: number };
  projectsInProgress?: { broj_projekata: number; budzet_ukupno_km: number };
};

const fmtKM = (v: number) => (Number.isFinite(v) ? v.toFixed(2).replace(".", ",") + " KM" : "—");

const cardBase: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  padding: "16px 18px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
};

function loadDashboard(): Promise<Dashboard> {
  return fetch("/api/mobile/dashboard").then((r) => r.json());
}

export default function MobileDashboardClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    loadDashboard()
      .then((d) => setData(d))
      .catch(() => setData({ ok: false, error: "Greška učitavanja" }))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)", fontSize: 15 }}>
        Učitavanje…
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        {data?.error ?? "Nema podataka"}
      </div>
    );
  }

  const pay = data.overduePayables;
  const rec = data.overdueReceivables;
  const fin = data.financeSummary;
  const proj = data.projectsInProgress;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "0 20px 20px",
      }}
    >
      <div style={{ alignSelf: "flex-end", marginBottom: 2 }}>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            cursor: refreshing ? "wait" : "pointer",
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          {refreshing ? (
            "Osvježavanje…"
          ) : (
            <>
              <span aria-hidden>↻</span>
              Osvježi
            </>
          )}
        </button>
      </div>

      {/* Dugovanja prekoračena */}
      {pay && (pay.items.length > 0 || pay.total_km > 0) && (
        <Link
          href="/finance/dugovanja?only_open=1"
          style={{ ...cardBase, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>
            Dugovanja prekoračena
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(251, 146, 60, 0.95)" }}>
            {fmtKM(pay.total_km)}
          </div>
          {pay.items.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {pay.items[0].title}
              {pay.items[0].kasni_dana > 0 && ` · ${pay.items[0].kasni_dana} d. kašnjenja`}
            </div>
          )}
        </Link>
      )}

      {/* Potraživanja prekoračena */}
      {rec && (rec.items.length > 0 || rec.total_km > 0) && (
        <Link
          href="/naplate?only_late=1"
          style={{ ...cardBase, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>
            Potraživanja prekoračena
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(251, 146, 60, 0.95)" }}>
            {fmtKM(rec.total_km)}
          </div>
          {rec.items.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {rec.items[0].broj_fakture} · {rec.items[0].radni_naziv}
              {rec.items[0].kasni_dana > 0 && ` · ${rec.items[0].kasni_dana} d.`}
            </div>
          )}
        </Link>
      )}

      {/* Fakturisano − Troškovi = Dobit */}
      {fin && (
        <div style={cardBase}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 8 }}>
            Finansije {fin.year}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.85 }}>Fakturisano</span>
              <span style={{ fontWeight: 700 }}>{fmtKM(fin.fakturisano_km)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.85 }}>Troškovi</span>
              <span style={{ fontWeight: 700 }}>{fmtKM(fin.troskovi_km)}</span>
            </div>
            <div
              style={{
                marginTop: 6,
                paddingTop: 8,
                borderTop: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: 17,
                color: fin.dobit_km >= 0 ? "rgba(34, 197, 94, 0.95)" : "rgba(239, 68, 68, 0.95)",
              }}
            >
              <span>Dobit</span>
              <span>{fmtKM(fin.dobit_km)}</span>
            </div>
          </div>
          <Link
            href="/izvjestaji/svi"
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
            }}
          >
            Svi izvještaji →
          </Link>
        </div>
      )}

      {/* Projekti u izradi */}
      {proj && (proj.broj_projekata > 0 || proj.budzet_ukupno_km > 0) && (
        <Link
          href="/projects?status_group=active"
          style={{ ...cardBase, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>
            Projekti u izradi
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(134, 239, 172, 0.95)" }}>
            {fmtKM(proj.budzet_ukupno_km)}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            {proj.broj_projekata} projekata
          </div>
        </Link>
      )}
    </div>
  );
}
