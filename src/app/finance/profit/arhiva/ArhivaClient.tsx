"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import ProfitTopActions from "../ProfitTopActions";

const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMaj", "monthJun", "monthJul", "monthAug", "monthSep", "monthOkt", "monthNov", "monthDec"] as const;

type MonthCell = { vrijednost: number; troskovi: number; profit: number };
type YearRow = {
  godina: number;
  mjeseci_arr: MonthCell[];
  ukupno_vrijednost: number;
  ukupno_troskovi: number;
  ukupno_profit: number;
};

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("bs-BA", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

export default function ArhivaClient() {
  const { t } = useTranslation();
  const mjeseciNames = MONTH_KEYS.map((k) => t(`dashboard.${k}`));
  const [data, setData] = useState<{ tableData: YearRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/izvjestaji/stg-arhiva", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.tableData)) setData({ tableData: j.tableData });
        else setError(j?.error ?? "Greška učitavanja");
      })
      .catch((e) => setError(e?.message ?? "Greška"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="profitReportBody">
      <div className="reportSection">
        {loading && <div className="reportLoading">{t("common.loading")}</div>}
        {error && <div className="reportError">{error}</div>}
        {!loading && !error && data && data.tableData.length > 0 && (
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 64, background: "rgba(255,235,150,0.2)" }}>{t("dashboard.colYearShort")}</th>
                  {mjeseciNames.map((m) => (
                    <th key={m} className="num" style={{ width: 72 }}>{m}</th>
                  ))}
                  <th className="num bold" style={{ width: 100, background: "rgba(150,200,255,0.2)" }}>Vrijednost</th>
                  <th className="num bold" style={{ width: 100, background: "rgba(251,146,60,0.2)" }}>Troškovi</th>
                  <th className="num bold" style={{ width: 100, background: "rgba(34,197,94,0.15)" }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.tableData.map((r) => (
                  <tr key={r.godina}>
                    <td style={{ background: "rgba(255,235,150,0.15)" }}>{r.godina}</td>
                    {r.mjeseci_arr.map((c, i) => (
                      <td key={i} className="num">{fmt(c.profit)}</td>
                    ))}
                    <td className="num bold" style={{ background: "rgba(150,200,255,0.1)" }}>{fmt(r.ukupno_vrijednost)}</td>
                    <td className="num bold" style={{ background: "rgba(251,146,60,0.1)" }}>{fmt(r.ukupno_troskovi)}</td>
                    <td className="num bold" style={{ background: "rgba(34,197,94,0.1)" }}>{fmt(r.ukupno_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && data && data.tableData.length === 0 && (
          <div className="reportNote">Nema podataka u arhivi (stg_master_finansije, datum_zavrsetka do 31.12.2025).</div>
        )}
      </div>
    </div>
  );
}
