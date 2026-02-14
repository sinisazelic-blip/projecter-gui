"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MJESI = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

function fmtKM(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Math.round(n).toLocaleString("bs-BA", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function getUkuno(r, field) {
  if (field === "promet") return r.ukuno;
  if (field === "troskovi") return r.troskovi_ukuno;
  return r.zarada_ukuno;
}

function getSum(tableData, field) {
  if (!tableData?.length) return 0;
  return tableData.reduce((s, r) => s + (getUkuno(r, field) || 0), 0);
}

function TableBlock({ title, tableData, field }) {
  return (
    <div className="reportTableWrap">
      <div className="reportTableTitle">{title}</div>
      <div className="table-wrap">
        <table className="card tableCard reportTable">
          <thead>
            <tr>
              <th style={{ width: 60 }}>God.</th>
              {MJESI.map((m) => (
                <th key={m} style={{ width: 72 }}>{m}</th>
              ))}
              <th style={{ width: 100 }}>ukuno</th>
              <th style={{ width: 120 }}>prosjek mjesečno</th>
            </tr>
          </thead>
          <tbody>
            {tableData?.map((r) => (
              <tr key={r.godina}>
                <td>{r.godina}</td>
                {r.mjeseci_arr?.map((m, i) => (
                  <td key={i} className="num">
                    {m[field] ? fmtKM(m[field]) : "—"}
                  </td>
                ))}
                <td className="num bold">{fmtKM(getUkuno(r, field))}</td>
                <td className="num">
                  {r.broj_mjeseci > 0 ? (
                    <>
                      {fmtKM(field === "promet" ? r.prosjek_mjesecno : field === "troskovi" ? r.prosjek_troskovi : r.prosjek_zarada)}
                      <span
                        className={`trendIcon ${r.trend > 0 ? "trendUp" : r.trend < 0 ? "trendDown" : ""}`}
                        title={r.trend > 0 ? "Rast" : r.trend < 0 ? "Pad" : "—"}
                      >
                        {r.trend > 0 ? "↑" : r.trend < 0 ? "↓" : "—"}
                      </span>
                      <span className="mjesecCount">({r.broj_mjeseci})</span>
                    </>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="footerRow">
              <td colSpan={13}></td>
              <td className="num bold">{fmtKM(getSum(tableData, field))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function GrafickiClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/izvjestaji/stg-master", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        if (j?.ok) setData(j);
        else setErr(j?.error || "Greška učitavanja");
      })
      .catch((e) => setErr(e?.message || "Greška"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="reportLoading">
        Učitavanje…
      </div>
    );
  }

  if (err) {
    return (
      <div className="reportError">
        {err}
      </div>
    );
  }

  const { tableData, chartYearly } = data || {};

  return (
    <div className="reportBody">
      <div className="reportSection">
        <h3 className="reportSectionTitle">Promet (iznos_km)</h3>
        <TableBlock title="UKUPNO sa troškovima" tableData={tableData} field="promet" />
      </div>

      <div className="reportSection">
        <h3 className="reportSectionTitle">Troškovi (iznos_troska_km)</h3>
        <TableBlock title="Troškovi" tableData={tableData} field="troskovi" />
      </div>

      <div className="reportSection">
        <h3 className="reportSectionTitle">Zarada (promet − troškovi)</h3>
        <TableBlock title="Zarada" tableData={tableData} field="zarada" />
      </div>

      <div className="reportSection reportCharts">
        <h3 className="reportSectionTitle">Grafikoni</h3>
        <div className="chartGrid">
          <div className="chartCard">
            <div className="chartTitle">Promet po godini</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartYearly} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="godina" stroke="rgba(255,255,255,0.6)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)} />
                <Tooltip
                  formatter={(v) => fmtKM(v)}
                  contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10 }}
                />
                <Bar dataKey="promet" fill="rgba(59, 130, 246, 0.8)" name="Promet" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chartCard">
            <div className="chartTitle">Troškovi i Zarada po godini</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartYearly} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="godina" stroke="rgba(255,255,255,0.6)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)} />
                <Tooltip
                  formatter={(v) => fmtKM(v)}
                  contentStyle={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10 }}
                />
                <Legend />
                <Bar dataKey="troskovi" fill="rgba(251, 146, 60, 0.8)" name="Troškovi" radius={[4, 4, 0, 0]} />
                <Bar dataKey="zarada" fill="rgba(34, 197, 94, 0.8)" name="Zarada" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="reportNote">
        Izvor: stg_master_finansije (arhiva 2006 – 31.12.2025). datum_zavrsetka.
      </div>
    </div>
  );
}
