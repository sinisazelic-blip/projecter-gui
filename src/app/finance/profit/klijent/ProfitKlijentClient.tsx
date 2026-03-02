"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MJESI_NAMES = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

type MonthCell = {
  realized: number;
  troskovi: number;
  vat: number;
  profit: number;
  margin_pct: number;
};

type YearRow = {
  godina: number;
  mjeseci_arr: MonthCell[];
  avg_margin_pct: number;
};

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

export default function ProfitKlijentClient() {
  const { t } = useTranslation();
  const [klijenti, setKlijenti] = useState<{ klijent_id: number; naziv_klijenta: string }[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [data, setData] = useState<{
    tableData: YearRow[];
    chartYearly: { godina: string; margin: number }[];
    klijent_naziv: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/klijenti", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        const list = j?.ok && Array.isArray(j.rows) ? j.rows : [];
        setKlijenti(list.map((r: any) => ({ klijent_id: r.klijent_id ?? r.id, naziv_klijenta: r.naziv_klijenta ?? r.naziv ?? "—" })));
      })
      .catch(() => setKlijenti([]));
  }, []);

  useEffect(() => {
    if (!selectedId || selectedId <= 0) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/izvjestaji/margin-by-klijent?klijent_id=${selectedId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        if (j?.ok) {
          setData({
            tableData: j.tableData ?? [],
            chartYearly: j.chartYearly ?? [],
            klijent_naziv: j.klijent_naziv ?? "—",
          });
        } else setError(j?.error ?? "Greška");
      })
      .catch((e) => {
        setError(e?.message ?? "Greška");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const printTitle = data?.klijent_naziv
    ? (t("dashboard.klijentReportTitle") || "Margin prema {naziv} klijent").replace("{naziv}", data.klijent_naziv)
    : t("dashboard.marginPoKlijentuTitle");

  return (
    <div className="profitReportBody">
      <div className="printTitle" id="profit-klijent-print-title">
        {printTitle}
      </div>

      <div className="reportSection">
        <div className="filterRow no-print" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="label">{t("dashboard.klijenti")}:</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text)",
              minWidth: 220,
            }}
          >
            <option value="">— Odaberi klijenta —</option>
            {klijenti.map((k) => (
              <option key={k.klijent_id} value={k.klijent_id}>
                {k.naziv_klijenta}
              </option>
            ))}
          </select>
        </div>

        {loading && <div className="reportLoading">Učitavanje…</div>}
        {error && <div className="reportError">{error}</div>}

        {!loading && !error && data && data.tableData.length > 0 && (
          <>
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>God.</th>
                    {MJESI_NAMES.map((m) => (
                      <th key={m} className="num" style={{ width: 64 }}>
                        {m}
                      </th>
                    ))}
                    <th className="num bold" style={{ width: 90 }}>
                      {t("dashboard.avgMargin")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.tableData.map((r) => (
                    <tr key={r.godina}>
                      <td>{r.godina}</td>
                      {r.mjeseci_arr.map((c, i) => (
                        <td key={i} className="num">
                          {fmtPct(c.margin_pct)}
                        </td>
                      ))}
                      <td className="num bold">{fmtPct(r.avg_margin_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="reportSection reportCharts" style={{ marginTop: 24 }}>
              <h3 className="reportSectionTitle">{t("dashboard.marginByYear")} — {data.klijent_naziv}</h3>
              <div className="chartCard">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.chartYearly} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="godina" stroke="rgba(255,255,255,0.6)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(v: number) => `${v}%`}
                      contentStyle={{
                        background: "rgba(0,0,0,0.85)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar dataKey="margin" fill="rgba(251, 191, 36, 0.8)" name="Margin %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {!loading && !error && data && data.tableData.length === 0 && selectedId && (
          <div className="reportNote">Nema podataka za izabranog klijenta.</div>
        )}

        {!loading && !selectedId && (
          <div className="reportNote">Odaberi klijenta za prikaz izvještaja.</div>
        )}
      </div>
    </div>
  );
}
