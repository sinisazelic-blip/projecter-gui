// src/app/izvodi/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { downloadExcel } from "@/lib/exportExcel";
import { useTranslation } from "@/components/LocaleProvider";

function fmtDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)} ${ccy}`;
}

type Izvod = {
  batch_id: number;
  source: string | null;
  bank_account_no: string | null;
  statement_no: string | null;
  statement_date: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  total_debit: number | null;
  total_credit: number | null;
  currency: string | null;
  imported_at: string | null;
};

export default function IzvodiPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [izvodi, setIzvodi] = useState<Izvod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accountFilter = sp.get("account") || "";
  const dateFromFilter = sp.get("date_from") || "";
  const dateToFilter = sp.get("date_to") || "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        if (accountFilter) qs.set("account", accountFilter);
        if (dateFromFilter) qs.set("date_from", dateFromFilter);
        if (dateToFilter) qs.set("date_to", dateToFilter);

        const res = await fetch(`/api/bank/batch?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || t("fakture.loadError"));
        }

        setIzvodi(data.batches || []);
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [accountFilter, dateFromFilter, dateToFilter]);

  function handleFilter() {
    const qs = new URLSearchParams();
    const accountInput = (
      document.getElementById("account") as HTMLInputElement
    )?.value.trim();
    const dateFromInput = (
      document.getElementById("date_from") as HTMLInputElement
    )?.value.trim();
    const dateToInput = (
      document.getElementById("date_to") as HTMLInputElement
    )?.value.trim();

    if (accountInput) qs.set("account", accountInput);
    if (dateFromInput) qs.set("date_from", dateFromInput);
    if (dateToInput) qs.set("date_to", dateToInput);

    router.push(`/izvodi?${qs.toString()}`);
  }

  function handleReset() {
    router.push("/izvodi");
  }

  return (
    <div className="container">
      <style>{`
        .tableCard {
          overflow-x: auto;
          width: 100%;
          margin: 0;
        }
        .table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .table th,
        .table td {
          padding: 12px 16px;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .table th:nth-child(1),
        .table td:nth-child(1) { width: 180px; }  /* Broj izvoda */
        .table th:nth-child(2),
        .table td:nth-child(2) { width: 200px; }  /* Datum izvoda */
        .table th:nth-child(3),
        .table td:nth-child(3) { 
          width: auto;
          white-space: normal;
          word-break: break-all;
        }  /* Broj računa */
        .table .num {
          text-align: right;
          font-family: 'Courier New', monospace;
        }
      `}</style>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow" style={{ justifyContent: "space-between" }}>
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">🏦 {t("izvodi.title")}</div>
                  <div className="brandSub">{t("izvodi.subtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link
                  href="/dashboard"
                  className="btn"
                  style={{ minWidth: 130 }}
                  title={t("izvodi.backToDashboard")}
                >
                  🏠 {t("common.dashboard")}
                </Link>
                <Link
                  href="/banking/import"
                  className="btn"
                  style={{ fontSize: 13 }}
                  title={t("izvodi.importIzvodaTitle")}
                >
                  {t("izvodi.importIzvoda")}
                </Link>
                {izvodi.length > 0 && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 13 }}
                    onClick={() => {
                      const headers = ["Broj izvoda", "Datum izvoda", "Broj računa", "Otvaranje", "Zatvaranje", "Valuta", "Uvezeno"];
                      const rows = izvodi.map((i) => [
                        i.statement_no || `#${i.batch_id}`,
                        fmtDDMMYYYY(i.statement_date),
                        i.bank_account_no ?? "—",
                        i.opening_balance ?? "",
                        i.closing_balance ?? "",
                        i.currency ?? "—",
                        i.imported_at ? String(i.imported_at).slice(0, 19) : "—",
                      ]);
                      downloadExcel({
                        filename: "izvodi_lista",
                        sheetName: "Izvodi",
                        headers,
                        rows,
                      });
                    }}
                    title={t("izvodi.exportExcelTitle")}
                  >
                    {t("izvodi.exportExcel")}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <label className="label">{t("izvodi.account")}:</label>
                <input
                  id="account"
                  type="text"
                  defaultValue={accountFilter}
                  placeholder={`${t("izvodi.account")}...`}
                  className="input small"
                  style={{ width: 150 }}
                />

                <label className="label">{t("izvodi.dateFrom")}:</label>
                <input
                  id="date_from"
                  type="date"
                  defaultValue={dateFromFilter}
                  className="input small"
                  style={{ width: 150 }}
                />

                <label className="label">{t("izvodi.dateTo")}:</label>
                <input
                  id="date_to"
                  type="date"
                  defaultValue={dateToFilter}
                  className="input small"
                  style={{ width: 150 }}
                />

                <button
                  type="button"
                  className="btn"
                  onClick={handleFilter}
                  style={{ fontSize: 13 }}
                >
                  🔎 {t("izvodi.filter")}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={handleReset}
                  style={{ fontSize: 13 }}
                >
                  🔄 {t("izvodi.reset")}
                </button>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
              {t("common.loading")}
            </div>
          ) : error ? (
            <div
              style={{
                padding: 20,
                background: "rgba(255, 59, 48, 0.1)",
                borderRadius: 8,
                color: "#ff3b30",
              }}
            >
              ⚠️ {error}
            </div>
          ) : (
            <div className="tableCard">
              <table className="table">
                <thead>
                  <tr>
                    <th>Broj izvoda</th>
                    <th>Datum izvoda</th>
                    <th>Broj računa</th>
                  </tr>
                </thead>
                <tbody>
                  {izvodi.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ opacity: 0.7, padding: 20 }}>
                        Nema izvoda za zadate filtere.
                      </td>
                    </tr>
                  ) : (
                    izvodi.map((izvod) => (
                      <tr
                        key={izvod.batch_id}
                        onClick={() => {
                          // Otvori detalje izvoda
                          router.push(`/izvodi/${izvod.batch_id}`);
                        }}
                        style={{ cursor: "pointer" }}
                        className="clickable-row"
                      >
                        <td style={{ fontWeight: 600 }}>{izvod.statement_no || `#${izvod.batch_id}`}</td>
                        <td>{fmtDDMMYYYY(izvod.statement_date)}</td>
                        <td>{izvod.bank_account_no || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
