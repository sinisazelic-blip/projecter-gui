"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const MONTH_KEYS = [
  "monthJan",
  "monthFeb",
  "monthMar",
  "monthApr",
  "monthMaj",
  "monthJun",
  "monthJul",
  "monthAug",
  "monthSep",
  "monthOkt",
  "monthNov",
  "monthDec",
];

function fmtAmt(n, locale) {
  const v = Number(n) || 0;
  const loc = locale === "en" ? "en-GB" : "bs-BA";
  return v.toLocaleString(loc, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const part = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return "—";
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
}

export default function PdvYearPopup({ initialYear, locale = "sr" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState([]);
  const [totals, setTotals] = useState(null);

  const load = useCallback(async (y) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/pdv/year?year=${y}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Load failed");
      setMonths(Array.isArray(data.months) ? data.months : []);
      setTotals(data.totals || null);
      setYear(data.year);
    } catch (e) {
      setError(e?.message || t("pdv.yearLoadError"));
      setMonths([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when opened / year changed via buttons
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function changeYear(delta) {
    const next = year + delta;
    setYear(next);
    load(next);
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ padding: "8px 16px" }}
        title={t("pdv.yearListTitle")}
        onClick={() => setOpen(true)}
      >
        {t("pdv.yearList")}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("pdv.yearListTitle")}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 100%)",
              maxHeight: "min(86vh, 720px)",
              overflow: "auto",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 0,
              background: "var(--panel)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                position: "sticky",
                top: 0,
                background: "var(--panel)",
                zIndex: 1,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {t("pdv.yearListHeading")}
                </div>
                <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
                  {t("pdv.yearListHint")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => changeYear(-1)}
                  disabled={loading}
                  title={t("pdv.prevYear")}
                >
                  ←
                </button>
                <strong style={{ minWidth: 52, textAlign: "center" }}>{year}</strong>
                <button
                  type="button"
                  className="btn"
                  onClick={() => changeYear(1)}
                  disabled={loading}
                  title={t("pdv.nextYear")}
                >
                  →
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                  title={t("common.close")}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              {loading ? (
                <div className="subtle" style={{ padding: 24, textAlign: "center" }}>
                  …
                </div>
              ) : error ? (
                <div style={{ padding: 16, color: "var(--danger, #e66)" }}>{error}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ margin: 0, width: "100%" }}>
                    <thead>
                      <tr>
                        <th>{t("pdv.colMonth")}</th>
                        <th style={{ textAlign: "right" }}>{t("pdv.izlazniPdv")}</th>
                        <th style={{ textAlign: "right" }}>{t("pdv.ulazniPdv")}</th>
                        <th style={{ textAlign: "right" }}>{t("pdv.saldoMjeseca")}</th>
                        <th style={{ textAlign: "right" }}>{t("pdv.preneto")}</th>
                        <th style={{ textAlign: "right" }}>{t("pdv.netoCol")}</th>
                        <th>{t("pdv.colRok")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((row) => {
                        const monthLabel = t(`dashboard.${MONTH_KEYS[row.month - 1]}`);
                        const muted = !row.has_activity && !(row.preneto_km > 0.004);
                        const isPretplata = (row.pretplata_km || 0) > 0.004;
                        const netoVal = isPretplata ? row.pretplata_km : row.za_uplatu_km;
                        return (
                          <tr
                            key={`${row.year}-${row.month}`}
                            style={muted ? { opacity: 0.55 } : undefined}
                          >
                            <td style={{ fontWeight: row.has_activity || row.preneto_km > 0.004 ? 700 : 400 }}>
                              {monthLabel} {row.year}
                            </td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {fmtAmt(row.pdv_izlazni_km, locale)}
                            </td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {fmtAmt(row.pdv_ulazni_km, locale)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontVariantNumeric: "tabular-nums",
                                color: row.saldo_mjeseca_km < 0 ? "var(--accent)" : undefined,
                              }}
                            >
                              {fmtAmt(row.saldo_mjeseca_km ?? row.za_prijavu_km, locale)}
                            </td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {fmtAmt(row.preneto_km, locale)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                color: isPretplata ? "var(--accent)" : undefined,
                              }}
                              title={isPretplata ? t("pdv.pretplata") : t("pdv.zaUplatu")}
                            >
                              {isPretplata ? `−${fmtAmt(netoVal, locale)}` : fmtAmt(netoVal, locale)}
                              <div className="subtle" style={{ fontSize: 10, fontWeight: 400 }}>
                                {isPretplata ? t("pdv.pretplataShort") : t("pdv.zaUplatuShort")}
                              </div>
                            </td>
                            <td className="subtle" style={{ fontSize: 12 }}>
                              {fmtDate(row.rok_predaje)}
                            </td>
                            <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                              <a
                                className="btn"
                                href={`/finance/pdv?from=${row.from}&to=${row.to}`}
                                style={{ padding: "4px 10px", marginRight: 6, fontSize: 12 }}
                              >
                                {t("pdv.openPeriod")}
                              </a>
                              <a
                                className="btn btn--orange-accent"
                                href={`/finance/pdv/obrazac?from=${row.from}&to=${row.to}`}
                                style={{ padding: "4px 10px", fontSize: 12 }}
                              >
                                {t("pdv.obrazacShort")}
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                      {totals ? (
                        <tr style={{ borderTop: "2px solid var(--border)" }}>
                          <td style={{ fontWeight: 800 }}>{t("pdv.yearTotal")}</td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            {fmtAmt(totals.pdv_izlazni_km, locale)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            {fmtAmt(totals.pdv_ulazni_km, locale)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            {fmtAmt(totals.saldo_mjeseci_km ?? totals.za_prijavu_km, locale)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }} className="subtle">
                            {fmtAmt(totals.preneto_godina_km, locale)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            <div>{fmtAmt(totals.za_uplatu_km, locale)}</div>
                            <div className="subtle" style={{ fontSize: 10, fontWeight: 400 }}>
                              {t("pdv.yearUplataSum")}
                            </div>
                            {(totals.pretplata_kraj_km || 0) > 0.004 ? (
                              <div style={{ color: "var(--accent)", fontSize: 11, marginTop: 4 }}>
                                {t("pdv.yearEndCredit")}: {fmtAmt(totals.pretplata_kraj_km, locale)}
                              </div>
                            ) : null}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
