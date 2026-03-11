"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale } from "@/lib/i18n";

type Dashboard = {
  ok: boolean;
  error?: string;
  overduePayables?: { items: { title: string; iznos_km: number; kasni_dana: number }[]; total_km: number };
  overdueReceivables?: { items: { broj_fakture: string; radni_naziv: string; iznos_km: number; kasni_dana: number }[]; total_km: number };
  financeSummary?: { year: number; fakturisano_km: number; troskovi_km: number; dobit_km: number };
  projectsInProgress?: { broj_projekata: number; budzet_ukupno_km: number };
};

function fmtAmount(v: number, locale: string) {
  const curr = getCurrencyForLocale(locale);
  return Number.isFinite(v) ? v.toFixed(2).replace(".", ",") + " " + curr : "—";
}

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
  const { t, locale } = useTranslation();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    loadDashboard()
      .then((d) => setData(d))
      .catch(() => setData({ ok: false, error: t("mobile.loadError") }))
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
        {t("common.loading")}
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        {data?.error ?? t("mobile.noData")}
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
            t("mobile.refreshing")
          ) : (
            <>
              <span aria-hidden>↻</span>
              {t("mobile.refresh")}
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
            {t("mobile.overduePayables")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(251, 146, 60, 0.95)" }}>
            {fmtAmount(pay.total_km, locale)}
          </div>
          {pay.items.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {pay.items[0].title}
              {pay.items[0].kasni_dana > 0 && ` · ${pay.items[0].kasni_dana} ${t("mobile.daysLate")}`}
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
            {t("mobile.overdueReceivables")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(251, 146, 60, 0.95)" }}>
            {fmtAmount(rec.total_km, locale)}
          </div>
          {rec.items.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {rec.items[0].broj_fakture} · {rec.items[0].radni_naziv}
              {rec.items[0].kasni_dana > 0 && ` · ${rec.items[0].kasni_dana} ${t("mobile.daysShort")}`}
            </div>
          )}
        </Link>
      )}

      {/* Fakturisano − Troškovi = Dobit */}
      {fin && (
        <div style={cardBase}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 8 }}>
            {t("mobile.financeYear").replace("{year}", String(fin.year))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.85 }}>{t("mobile.invoiced")}</span>
              <span style={{ fontWeight: 700 }}>{fmtAmount(fin.fakturisano_km, locale)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.85 }}>{t("mobile.costs")}</span>
              <span style={{ fontWeight: 700 }}>{fmtAmount(fin.troskovi_km, locale)}</span>
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
              <span>{t("mobile.profit")}</span>
              <span>{fmtAmount(fin.dobit_km, locale)}</span>
            </div>
          </div>
          {locale !== "en" && (
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
              {t("mobile.allReports")}
            </Link>
          )}
        </div>
      )}

      {/* Projekti u izradi */}
      {proj && (proj.broj_projekata > 0 || proj.budzet_ukupno_km > 0) && (
        <Link
          href="/projects?status_group=active"
          style={{ ...cardBase, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 6 }}>
            {t("mobile.projectsInProgress")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "rgba(134, 239, 172, 0.95)" }}>
            {fmtAmount(proj.budzet_ukupno_km, locale)}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            {t("mobile.projectsCount").replace("{n}", String(proj.broj_projekata))}
          </div>
        </Link>
      )}
    </div>
  );
}
