// src/app/izvodi/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { downloadExcel } from "@/lib/exportExcel";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

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

type BankAccount = {
  bank_account_no: string;
  currency: string | null;
};

export default function IzvodiPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [izvodi, setIzvodi] = useState<Izvod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Izvod | null>(null);

  const accountFilter = sp.get("account") || "";
  const currencyFilter = sp.get("currency") || "";
  const dateFromFilter = sp.get("date_from") || "";
  const dateToFilter = sp.get("date_to") || "";

  // Učitaj listu računa (za tabove)
  useEffect(() => {
    fetch("/api/bank/batch?accounts_only=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.accounts)) {
          setAccounts(
            d.accounts.map((a: any) => ({
              bank_account_no: String(a.bank_account_no ?? ""),
              currency: a.currency ? String(a.currency) : null,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        if (accountFilter) qs.set("account", accountFilter);
        if (currencyFilter) qs.set("currency", currencyFilter);
        if (dateFromFilter) qs.set("date_from", dateFromFilter);
        if (dateToFilter) qs.set("date_to", dateToFilter);

        const res = await fetch(`/api/bank/batch?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || t("izvodi.loadError"));
        }

        const batches = data.batches || [];
        setIzvodi(
          [...batches].sort((a, b) => {
            const da = a.statement_date || "";
            const db = b.statement_date || "";
            return db.localeCompare(da);
          })
        );
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [accountFilter, currencyFilter, dateFromFilter, dateToFilter]);

  function selectAccount(acc: BankAccount | null) {
    const qs = new URLSearchParams();
    if (acc) {
      qs.set("account", acc.bank_account_no);
      if (acc.currency) qs.set("currency", acc.currency);
    }
    if (dateFromFilter) qs.set("date_from", dateFromFilter);
    if (dateToFilter) qs.set("date_to", dateToFilter);
    router.push(`/izvodi?${qs.toString()}`);
  }

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

  const selectedAccountKey =
    accountFilter && currencyFilter
      ? `${accountFilter}|${currencyFilter}`
      : accountFilter
        ? `${accountFilter}|`
        : null;

  async function handleDelete(izvod: Izvod, e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(izvod);
  }

  async function confirmDeleteBatch() {
    if (!confirmDelete) return;
    const batch_id = confirmDelete.batch_id;
    setDeletingId(batch_id);
    setConfirmDelete(null);
    try {
      const res = await fetch("/api/bank/batch/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t("izvodi.deleteError"));
      }
      setIzvodi((prev) => prev.filter((i) => i.batch_id !== batch_id));
    } catch (err: any) {
      setError(err?.message || t("izvodi.deleteError"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container">
      <style>{`
        .listWrap { min-width: 0; max-width: 100%; }
        .tableCard {
          overflow-x: auto;
          width: 100%;
          max-width: 100%;
          margin: 0;
          -webkit-overflow-scrolling: touch;
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
        .table th:nth-child(4),
        .table td:nth-child(4) { width: 90px; text-align: center; }  /* Akcija */
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
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">🏦 {t("izvodi.title")}</div>
                  <div className="brandSub">{t("izvodi.subtitle")}</div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="btn"
                style={{ minWidth: 130 }}
                title={t("izvodi.backToDashboard")}
              >
                <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
              </Link>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                    const headers = [
                      t("izvodi.colStatementNo"),
                      t("izvodi.colStatementDate"),
                      t("izvodi.colAccountNo"),
                      t("izvodi.colOpening"),
                      t("izvodi.colClosing"),
                      t("izvodi.colCurrency"),
                      t("izvodi.colImported"),
                    ];
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
                      sheetName: t("izvodi.excelSheetName"),
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

            {/* Tabovi po računu: BAM izvod 1 i EUR izvod 1 su odvojeno */}
            {accounts.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                  {t("izvodi.selectAccount")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      fontWeight: selectedAccountKey === null ? 700 : 400,
                      background:
                        selectedAccountKey === null
                          ? "var(--active-bg)"
                          : undefined,
                    }}
                    onClick={() => selectAccount(null)}
                  >
                    {t("izvodi.allAccounts")}
                  </button>
                  {accounts.map((acc) => {
                    const key =
                      `${acc.bank_account_no}|${acc.currency ?? ""}`;
                    const isSelected = selectedAccountKey === key;
                    const label = acc.currency
                      ? `${acc.bank_account_no} (${acc.currency})`
                      : acc.bank_account_no;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="btn"
                        style={{
                          fontWeight: isSelected ? 700 : 400,
                          background: isSelected ? "var(--active-bg)" : undefined,
                        }}
                        onClick={() => selectAccount(acc)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                    <th>{t("izvodi.colStatementNo")}</th>
                    <th>{t("izvodi.colStatementDate")}</th>
                    <th>{t("izvodi.colAccountNo")}</th>
                    <th>{t("izvodi.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {izvodi.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ opacity: 0.7, padding: 20 }}>
                        {t("izvodi.noIzvodi")}
                      </td>
                    </tr>
                  ) : (
                    izvodi.map((izvod) => (
                      <tr
                        key={izvod.batch_id}
                        onClick={() => {
                          if (deletingId === izvod.batch_id) return;
                          router.push(`/izvodi/${izvod.batch_id}`);
                        }}
                        style={{ cursor: "pointer" }}
                        className="clickable-row"
                      >
                        <td style={{ fontWeight: 600 }}>{izvod.statement_no || `#${izvod.batch_id}`}</td>
                        <td>{fmtDDMMYYYY(izvod.statement_date)}</td>
                        <td>{izvod.bank_account_no || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn"
                            disabled={deletingId !== null}
                            onClick={(e) => handleDelete(izvod, e)}
                            title={t("izvodi.deleteTitle")}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          >
                            {deletingId === izvod.batch_id ? "…" : t("izvodi.delete")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Potvrda brisanja */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 400,
              boxShadow: "var(--shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t("izvodi.deleteConfirmTitle")}
            </div>
            <p style={{ margin: "0 0 16px", opacity: 0.9 }}>
              {t("izvodi.deleteConfirmBody")}{" "}
              <strong>
                {confirmDelete.statement_no || `#${confirmDelete.batch_id}`}
              </strong>{" "}
              ({fmtDDMMYYYY(confirmDelete.statement_date)})?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmDelete(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--bad)", color: "#fff" }}
                onClick={confirmDeleteBatch}
              >
                {t("izvodi.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
