"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MJESI_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMaj", "monthJun", "monthJul", "monthAug", "monthSep", "monthOkt", "monthNov", "monthDec"] as const;

const colGodBg = { background: "rgba(255, 235, 150, 0.22)" };
const colMarginPctBg = { background: "rgba(150, 200, 255, 0.22)" };
const colProfitBg = { background: "rgba(34, 197, 94, 0.15)" };
const colMarginColBg = { background: "rgba(150, 200, 255, 0.22)" };

type MonthCell = {
  realized: number;
  troskovi: number;
  vat: number;
  profit: number;
  margin_pct: number;
};

type YearRow = {
  godina: number;
  mjeseci: Record<number, MonthCell>;
  mjeseci_arr: MonthCell[];
  avg_margin_pct: number;
};

function fmtNum(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("bs-BA", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

export default function ProfitReportClient({ initialView }: { initialView: "monthly" | "yearly" }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const view = (searchParams?.get("view") === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
  const mjeseciNames = useMemo(
    () => MONTH_KEYS.map((k) => t(`dashboard.${k}`)),
    [t],
  );
  const [data, setData] = useState<{
    tableData: YearRow[];
    chartYearly: { godina: string; margin: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [chartYear, setChartYear] = useState<number | null>(null);

  useEffect(() => {
    // Isti izvor kao Charts (stg-master) — 20 godina unazad iz stg_master_finansije + live od 2026
    fetch("/api/izvjestaji/stg-master", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        if (j?.ok && j?.tableData?.length) {
          const tableData = j.tableData.map((row: { godina: number; mjeseci_arr: { promet: number; troskovi: number; zarada: number }[] }) => {
            const mjeseci_arr: MonthCell[] = (row.mjeseci_arr || []).map((c: { promet: number; troskovi: number; zarada: number }) => {
              const promet = Number(c.promet ?? 0);
              const troskovi = Number(c.troskovi ?? 0);
              const zarada = Number(c.zarada ?? 0);
              return {
                realized: promet,
                troskovi,
                vat: 0,
                profit: zarada,
                margin_pct: troskovi > 0 ? (zarada / troskovi) * 100 : 0,
              };
            });
            const cellsWithActivity = mjeseci_arr.filter((c) => c.troskovi > 0 || c.realized > 0);
            const sumProfit = cellsWithActivity.reduce((s, c) => s + c.profit, 0);
            const sumCosts = cellsWithActivity.reduce((s, c) => s + c.troskovi, 0);
            const avg_margin_pct = sumCosts > 0 ? (sumProfit / sumCosts) * 100 : 0;
            return {
              godina: row.godina,
              mjeseci: {} as Record<number, MonthCell>,
              mjeseci_arr,
              avg_margin_pct,
            };
          });
          const chartYearly = tableData.map((r: YearRow) => ({
            godina: String(r.godina),
            margin: Math.round(r.avg_margin_pct * 10) / 10,
          }));
          setData({ tableData, chartYearly });
          if (selectedYears.length === 0) {
            const lastYear = tableData[tableData.length - 1]?.godina;
            if (lastYear) setSelectedYears([lastYear]);
          }
        } else if (j?.ok) {
          setData({ tableData: [], chartYearly: [] });
        } else {
          setError(j?.error || "Greška");
        }
      })
      .catch((e) => setError(e?.message || "Greška"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data?.tableData?.length && selectedYears.length === 0) {
      const lastYear = data.tableData[data.tableData.length - 1]?.godina;
      if (lastYear) setSelectedYears([lastYear]);
    }
  }, [data, selectedYears.length]);

  if (loading) return <div className="reportLoading">Učitavanje…</div>;
  if (error) return <div className="reportError">{error}</div>;
  if (!data?.tableData?.length) return <div className="reportNote">Nema podataka za prikaz.</div>;

  const { tableData, chartYearly } = data;
  const allYears = tableData.map((r) => r.godina);

  const toggleYear = (y: number) => {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((yr) => yr !== y) : [...prev, y].sort((a, b) => a - b)
    );
  };

  // Monthly view: filter by selected years, one row per month across selected years (or one row per month per year?)
  // User said: "filter godine", "mjesec", "ukupan zbir realizovanih", "ukupan zbir troškova", "VAT", "Profit", "Margin"
  // So table: rows = months (1–12) but we can have multiple years selected, so we need rows like "2024-01", "2024-02" ... "2025-01" etc. Or one table per year. Simplest: one row per (year, month), filter by selected years.
  const monthlyRows: { year: number; month: number; monthName: string; cell: MonthCell }[] = [];
  for (const y of selectedYears) {
    const row = tableData.find((r) => r.godina === y);
    if (!row) continue;
    for (let m = 1; m <= 12; m++) {
      const cell = row.mjeseci_arr?.[m - 1] ?? row.mjeseci?.[m] ?? { realized: 0, troskovi: 0, vat: 0, profit: 0, margin_pct: 0 };
      if (cell.realized !== 0 || cell.troskovi !== 0) {
        monthlyRows.push({
          year: y,
          month: m,
          monthName: mjeseciNames[m - 1] || String(m),
          cell,
        });
      }
    }
  }
  monthlyRows.sort((a, b) => a.year - b.year || a.month - b.month);

  const effectiveChartYear = chartYear ?? (view === "monthly" && selectedYears.length > 0 ? selectedYears[selectedYears.length - 1] : tableData[tableData.length - 1]?.godina ?? null);
  const chartMonthlyForYear = effectiveChartYear != null
    ? tableData
        .find((r) => r.godina === effectiveChartYear)
        ?.mjeseci_arr?.map((c, i) => ({
          month: mjeseciNames[i] || String(i + 1),
          margin: Math.round(c.margin_pct * 10) / 10,
        })) ?? []
    : [];

  return (
    <div className="profitReportBody no-print">
      <div className="reportSection">
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/finance/profit?view=monthly" className={`btn ${view === "monthly" ? "btn--active" : ""}`}>
            {t("dashboard.mjesecni")}
          </Link>
          <Link href="/finance/profit?view=yearly" className={`btn ${view === "yearly" ? "btn--active" : ""}`}>
            {t("dashboard.godisnji")}
          </Link>
        </div>
        {view === "monthly" && (
          <div className="filterRow" style={{ marginBottom: 16 }}>
            <label className="label" style={{ marginRight: 8 }}>{t("dashboard.filterYears")}:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allYears.map((y) => (
                <label key={y} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(y)}
                    onChange={() => toggleYear(y)}
                  />
                  <span>{y}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {view === "monthly" && (
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>{t("dashboard.month")}</th>
                  <th className="num" style={{ color: "var(--muted)", fontSize: 12 }}>{t("dashboard.realized")}</th>
                  <th className="num" style={{ color: "var(--muted)", fontSize: 12 }}>{t("dashboard.costs")}</th>
                  <th className="num" style={{ color: "var(--muted)", fontSize: 12 }}>{t("dashboard.vat")}</th>
                  <th className="num bold" style={colProfitBg}>{t("dashboard.profitCol")}</th>
                  <th className="num bold" style={colMarginColBg}>{t("dashboard.marginCol")}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r) => (
                  <tr key={`${r.year}-${r.month}`}>
                    <td>{r.year} – {r.monthName}</td>
                    <td className="num" style={{ color: "var(--muted)", fontSize: 13 }}>{fmtNum(r.cell.realized)}</td>
                    <td className="num" style={{ color: "var(--muted)", fontSize: 13 }}>{fmtNum(r.cell.troskovi)}</td>
                    <td className="num" style={{ color: "var(--muted)", fontSize: 13 }}>{fmtNum(r.cell.vat)}</td>
                    <td className="num bold" style={colProfitBg}>{fmtNum(r.cell.profit)}</td>
                    <td className="num bold" style={colMarginColBg}>{fmtPct(r.cell.margin_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "yearly" && (
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 60, ...colGodBg }}>God.</th>
                  {mjeseciNames.map((m) => (
                    <th key={m} className="num" style={{ width: 64 }}>{m}</th>
                  ))}
                  <th className="num bold" style={{ width: 90, ...colMarginPctBg }}>{t("dashboard.marginPctCol")}</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((r) => (
                  <tr
                    key={r.godina}
                    onClick={() => setChartYear(r.godina)}
                    style={{ cursor: "pointer" }}
                    title={t("dashboard.marginByMonth") + " " + r.godina}
                  >
                    <td style={colGodBg}>{r.godina}</td>
                    {r.mjeseci_arr.map((c, i) => (
                      <td key={i} className="num">{fmtPct(c.margin_pct)}</td>
                    ))}
                    <td className="num bold" style={colMarginPctBg}>{fmtPct(r.avg_margin_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="reportSection reportCharts" style={{ marginTop: 24 }}>
        <h3 className="reportSectionTitle">{t("dashboard.marginByYear")}</h3>
        <div className="chartCard" style={{ marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartYearly} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="godina" stroke="rgba(255,255,255,0.6)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10 }} />
              <Bar dataKey="margin" fill="rgba(251, 191, 36, 0.8)" name="Margin %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h3 className="reportSectionTitle">
          {t("dashboard.marginByMonth")}
          {effectiveChartYear != null ? ` (${effectiveChartYear})` : " — " + (view === "yearly" ? "klikni godinu u tabeli" : "odabrana godina")}
        </h3>
        <div className="chartCard">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartMonthlyForYear.length ? chartMonthlyForYear : []}
              margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10 }} />
              <Bar dataKey="margin" fill="rgba(34, 197, 94, 0.8)" name="Margin %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="reportNote no-print" style={{ marginTop: 24 }}>
        Profit = Realizovano (sa VAT) − Troškovi − VAT. Margin % = Profit / Troškovi × 100. Izvor: fakture i projektni_troskovi (od 2026), stg_master (arhiva).
      </div>
    </div>
  );
}
