"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

type ImportResponse = {
  ok: boolean;
  error?: string;
  batch_id?: number;
  inserted?: number;
  duplicates?: number;
  parsed?: number;
  file_hash?: string;
};

type BatchResponse = {
  ok: boolean;
  error?: string;
  batch?: any;
  txs?: any[];
};

type BatchListResponse = {
  ok: boolean;
  batches: any[];
};

type AutoMatchResponse = {
  ok: boolean;
  batch_id?: number;
  scanned?: number;
  rules?: number;
  matched?: number;
  items?: any[];
  error?: string;
};

function fmtT(
  t: (key: string) => string,
  key: string,
  vars?: Record<string, string | number>,
) {
  let s = t(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v ?? ""));
    }
  }
  return s;
}

function fmtMoney(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("bs-BA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cleanSpaces(s: any) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function BankImportPage() {
  const { t } = useTranslation();
  // import
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<string>("1");
  const [bankAccounts, setBankAccounts] = useState<
    { bank_account_id: number; label: string; bank_naziv: string }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState<ImportResponse | null>(null);

  // batch
  const [batchRes, setBatchRes] = useState<BatchResponse | null>(null);
  const [batchList, setBatchList] = useState<any[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FEES" | "EXCH" | "IN" | "OUT">(
    "ALL",
  );

  const [autoMatchRes, setAutoMatchRes] = useState<AutoMatchResponse | null>(
    null,
  );
  const [autoMatching, setAutoMatching] = useState(false);
  const [showAdvancedOut, setShowAdvancedOut] = useState(false);

  // Commit batch
  const [committing, setCommitting] = useState(false);
  const [commitRes, setCommitRes] = useState<any | null>(null);

  const batchId = batchRes?.batch?.batch_id
    ? Number(batchRes.batch.batch_id)
    : null;

  async function loadBatchList() {
    const r = await fetch("/api/bank/batch", { cache: "no-store" });
    const j: BatchListResponse = await r.json();
    if (j.ok) {
      const list = (j.batches ?? []).slice().sort((a: any, b: any) => {
        const da = a.statement_date || "";
        const db = b.statement_date || "";
        return db.localeCompare(da);
      });
      setBatchList(list);
    }
  }

  async function loadBankAccounts() {
    try {
      const r = await fetch("/api/bank/accounts", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.accounts) && j.accounts.length) {
        setBankAccounts(j.accounts);
        setAccountId((prev) => {
          const ids = new Set(
            j.accounts.map((a: any) => String(a.bank_account_id)),
          );
          return ids.has(prev) ? prev : String(j.accounts[0].bank_account_id);
        });
      }
    } catch {
      // ostaje ručni unos fallback
    }
  }

  React.useEffect(() => {
    loadBankAccounts();
  }, []);

  async function loadBatch(id: number) {
    const r = await fetch(`/api/bank/batch?id=${id}`, { cache: "no-store" });
    const j: BatchResponse = await r.json();
    setBatchRes(j);
    setCommitRes(null);
    setAutoMatchRes(null);
  }

  async function onImport() {
    if (!file) {
      setImportRes({ ok: false, error: t("bankingImport.selectXmlFile") });
      return;
    }

    setImporting(true);
    setImportRes(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("account_id", accountId.trim());
      fd.append("mode", "staging");

      const name = String(file.name || "").toLowerCase();
      const isPdf =
        name.endsWith(".pdf") || file.type === "application/pdf";
      const endpoint = isPdf
        ? "/api/bank/import/nova-pdf"
        : "/api/bank/import/xml-v2";

      const r = await fetch(endpoint, {
        method: "POST",
        body: fd,
      });
      const text = await r.text();

      let j: ImportResponse;
      try {
        j = JSON.parse(text);
      } catch {
        setImportRes({
          ok: false,
          error: `${t("bankingImport.serverNotJson")} (HTTP ${r.status}). ${t("bankingImport.firstChars")}: ${text.slice(0, 200)}`,
        });
        return;
      }

      setImportRes(j);

      if (j.ok && j.batch_id) {
        await loadBatch(Number(j.batch_id));
        await loadBatchList();
      }
    } catch (e: any) {
      setImportRes({ ok: false, error: e?.message ?? t("bankingImport.error") });
    } finally {
      setImporting(false);
    }
  }

  async function runAutoMatch() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      setAutoMatchRes({ ok: false, error: t("bankingImport.noBatchSelected") });
      return;
    }

    setAutoMatching(true);
    setAutoMatchRes(null);

    try {
      const r = await fetch(`/api/bank/match/auto?batch_id=${bid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const text = await r.text();
      let j: AutoMatchResponse;
      try {
        j = JSON.parse(text);
      } catch {
        setAutoMatchRes({
          ok: false,
          error: `${t("bankingImport.serverNotJson")} (HTTP ${r.status}). ${t("bankingImport.firstChars")}: ${text.slice(0, 200)}`,
        });
        return;
      }

      setAutoMatchRes(j);

      if (j.ok) {
        await loadBatch(bid);
      }
    } catch (e: any) {
      setAutoMatchRes({ ok: false, error: e?.message ?? t("bankingImport.error") });
    } finally {
      setAutoMatching(false);
    }
  }

  async function commitBatch() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert(t("bankingImport.noBatch"));
      return;
    }

    setCommitting(true);
    setCommitRes(null);

    try {
      const r = await fetch("/api/bank/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: bid }),
      });

      const j = await r.json();
      setCommitRes(j);

      if (!j.ok) {
        alert(j.error || t("bankingImport.commitError"));
        return;
      }

      const inv = Number(j.matched_invoices ?? 0);
      const queue = Number(j.queue_cnt ?? j.unmatched_cnt ?? 0);
      alert(
        `✅ ${t("bankingImport.commitOk")} · ${j.affected_rows ?? "?"} postinga · ${t("bankingImport.commitAutoInvoices")}: ${inv}` +
          (queue > 0
            ? ` · ${fmtT(t, "bankingImport.commitQueueHint", { count: queue })}`
            : ""),
      );
    } finally {
      setCommitting(false);
    }
  }

  const txs = batchRes?.ok ? (batchRes.txs ?? []) : [];

  const filteredTxs = useMemo(() => {
    return txs.filter((t: any) => {
      const amount = Number(t.amount);
      const desc = String(t.description ?? "");
      const isFee = Number(t.is_fee) === 1;
      const isExch =
        desc.toUpperCase().includes("EXCH") || Number(t.tx_type) === 0;

      if (filter === "ALL") return true;
      if (filter === "FEES") return isFee;
      if (filter === "EXCH") return isExch;
      if (filter === "IN") return amount > 0;
      if (filter === "OUT") return amount < 0;
      return true;
    });
  }, [txs, filter]);

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo style={{}} /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("bankingImport.title")}</div>
                  <div className="brandSub">{t("bankingImport.subtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/izvodi"
                  className="btn"
                  title={t("izvodi.backToListTitle")}
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    fontWeight: 700,
                  }}
                >
                  ← {t("izvodi.title")}
                </Link>
                <Link
                  href="/finance/rasknjizavanje"
                  className="btn"
                  title={t("rasknjizavanje.title")}
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.1))",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                    fontWeight: 700,
                  }}
                >
                  {t("rasknjizavanje.title")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      {/* Import bar */}
      <div className="actions">
        <input
          type="file"
          accept=".xml,.pdf,application/xml,text/xml,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
          style={{ width: "auto", minWidth: 200 }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="label">{t("bankingImport.accountId")}</span>
          {bankAccounts.length > 0 ? (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input small"
              style={{ width: "auto", minWidth: 180 }}
              title="Bankovni račun firme (ne broj izvoda)"
            >
              {bankAccounts.map((a) => (
                <option key={a.bank_account_id} value={String(a.bank_account_id)}>
                  {a.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input small"
              style={{ width: 80 }}
              title="1 = UniCredit, 2 = Nova Banka"
            />
          )}
        </label>

        <button
          onClick={onImport}
          disabled={importing}
          className={`btn ${importing ? "btn--disabled" : ""}`}
          aria-disabled={importing}
        >
          {importing ? t("bankingImport.importing") : t("bankingImport.importToStaging")}
        </button>

        <button
          onClick={loadBatchList}
          className="btn"
        >
          {t("bankingImport.refreshBatchList")}
        </button>

        <button
          onClick={commitBatch}
          disabled={!batchId || committing}
          className={`btn btn-primary ${!batchId || committing ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || committing}
          title={
            !batchId
              ? t("bankingImport.selectBatchFirst")
              : t("bankingImport.writeToLedger")
          }
        >
          {committing ? t("bankingImport.committing") : t("bankingImport.commitBatch")}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: 12,
          padding: "12px 16px",
          background: "rgba(59,130,246,.08)",
          borderColor: "rgba(59,130,246,.25)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("bankingImport.workflowTitle")}</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
          <li>{t("bankingImport.workflowStep1")}</li>
          <li>{t("bankingImport.workflowStep2")}</li>
          <li>
            {t("bankingImport.workflowStep3")}{" "}
            <Link href="/finance/rasknjizavanje" style={{ fontWeight: 700 }}>
              {t("rasknjizavanje.title")} →
            </Link>
          </li>
        </ol>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          {t("bankingImport.workflowNote")}
        </p>
      </div>

      {batchId ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowAdvancedOut((v) => !v)}
          >
            {showAdvancedOut ? "▾" : "▸"} {t("bankingImport.advancedOutTitle")}
          </button>
          {showAdvancedOut ? (
            <div
              className="card"
              style={{
                marginTop: 8,
                padding: 12,
                background: "rgba(148,163,184,.06)",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: 13 }}>{t("bankingImport.advancedOutHint")}</p>
              <button
                onClick={runAutoMatch}
                disabled={autoMatching}
                className={`btn ${autoMatching ? "btn--disabled" : ""}`}
                aria-disabled={autoMatching}
              >
                {autoMatching ? t("bankingImport.autoMatching") : t("bankingImport.autoMatchOut")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Import result */}
      {importRes && (
        <div className="card" style={{ marginTop: 12 }}>
          {importRes.ok ? (
            <>
              <div style={{ fontWeight: 800 }}>✅ {t("bankingImport.importOk")}</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                batch_id: <b>{importRes.batch_id}</b> · parsed:{" "}
                <b>{importRes.parsed}</b> · inserted:{" "}
                <b>{importRes.inserted}</b> · duplicates:{" "}
                <b>{importRes.duplicates}</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                file_hash: {importRes.file_hash}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, color: "var(--bad)" }}>
                ❌ {t("bankingImport.importError")}
              </div>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {importRes.error}
              </div>
            </>
          )}
        </div>
      )}

      {/* Auto-match result */}
      {autoMatchRes && (
        <div className="card" style={{ marginTop: 12 }}>
          {autoMatchRes.ok ? (
            <>
              <div style={{ fontWeight: 800 }}>✅ {t("bankingImport.autoMatchOk")}</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                batch_id: <b>{autoMatchRes.batch_id}</b> · rules:{" "}
                <b>{autoMatchRes.rules}</b> · scanned:{" "}
                <b>{autoMatchRes.scanned}</b> · matched:{" "}
                <b>{autoMatchRes.matched}</b>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, color: "var(--bad)" }}>
                ❌ {t("bankingImport.autoMatchErrorTitle")}
              </div>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {autoMatchRes.error}
              </div>
            </>
          )}
        </div>
      )}

      {/* Commit result */}
      {commitRes && (
        <div className="card" style={{ marginTop: 12 }}>
          {commitRes.ok ? (
            <div>
              <div style={{ fontWeight: 900 }}>✅ {t("bankingImport.commitOkTitle")}</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                {t("bankingImport.commitAffected")}: <b>{commitRes.affected_rows ?? "—"}</b>
                {commitRes.matched_invoices != null ? (
                  <>
                    {" "}
                    · {t("bankingImport.commitAutoInvoices")}:{" "}
                    <b>{commitRes.matched_invoices}</b>
                  </>
                ) : null}
                {commitRes.queue_cnt != null && Number(commitRes.queue_cnt) > 0 ? (
                  <>
                    {" "}
                    · {fmtT(t, "bankingImport.commitQueueHint", {
                      count: commitRes.queue_cnt,
                    })}
                  </>
                ) : commitRes.unmatched_cnt != null && Number(commitRes.unmatched_cnt) > 0 ? (
                  <>
                    {" "}
                    · {fmtT(t, "bankingImport.commitQueueHint", {
                      count: commitRes.unmatched_cnt,
                    })}
                  </>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(34,197,94,.1)",
                  border: "1px solid rgba(34,197,94,.35)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {t("bankingImport.nextStepRasknjizavanje")}
                </div>
                <Link
                  href={`/finance/rasknjizavanje?batch_id=${batchId || commitRes.batch_id || ""}`}
                  className="btn btn-primary"
                >
                  {t("rasknjizavanje.openPanel")}
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--bad)" }}>
              <div style={{ fontWeight: 900 }}>❌ {t("bankingImport.commitErrorTitle")}</div>
              <div style={{ marginTop: 6 }}>{commitRes.error}</div>
            </div>
          )}
        </div>
      )}

      {/* Raw tx preview */}
      {batchRes?.ok && batchRes.batch && (
        <div className="card" style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                Batch #{batchRes.batch.batch_id} — {t("bankingImport.statementWord")} {batchRes.batch.statement_no} ({batchRes.batch.statement_date})
              </div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
                {t("bankingImport.account")}: <b>{batchRes.batch.bank_account_no}</b>
                {batchRes.batch.account_id != null ? (
                  <>
                    {" "}
                    · account_id: <b>{batchRes.batch.account_id}</b>
                  </>
                ) : null}
                {batchRes.batch.source ? (
                  <>
                    {" "}
                    · source: <b>{batchRes.batch.source}</b>
                  </>
                ) : null}
                {" "}
                · {t("bankingImport.company")}: <b>{batchRes.batch.company_name}</b>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14 }}>
                {t("bankingImport.openingBalance")}:{" "}
                <b>{fmtMoney(Number(batchRes.batch.opening_balance))}</b>
              </div>
              <div style={{ fontSize: 14 }}>
                {t("bankingImport.closingBalance")}:{" "}
                <b>{fmtMoney(Number(batchRes.batch.closing_balance))}</b>
              </div>
            </div>
          </div>

          <div className="tabRow" style={{ marginTop: 10 }}>
            {(["ALL", "FEES", "EXCH", "IN", "OUT"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`btn ${filter === k ? "btn--active" : ""}`}
              >
                {k === "ALL"
                  ? t("bankingImport.filterAll")
                  : k === "FEES"
                    ? t("bankingImport.filterFees")
                    : k === "EXCH"
                      ? t("bankingImport.filterExch")
                      : k === "IN"
                        ? t("bankingImport.filterIn")
                        : t("bankingImport.filterOut")}
              </button>
            ))}
          </div>

          <div className="cardTitle" style={{ marginBottom: 8, marginTop: 14 }}>
            {t("bankingImport.rawStagingPreview")} ({filteredTxs.length} / {txs.length})
          </div>

          <div className="tableCard table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("bankingImport.colDate")}</th>
                  <th>{t("bankingImport.colRef")}</th>
                  <th style={{ textAlign: "right" }}>{t("bankingImport.colAmount")}</th>
                  <th>{t("bankingImport.colToFrom")}</th>
                  <th>{t("bankingImport.colDescription")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((row: any) => {
                  const amount = Number(row.amount);
                  return (
                    <tr key={row.tx_id}>
                      <td className="nowrap">{row.value_date ?? ""}</td>
                      <td className="nowrap">{row.reference ?? ""}</td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 800,
                          color:
                            amount < 0
                              ? "var(--bad)"
                              : amount > 0
                                ? "var(--good)"
                                : undefined,
                        }}
                      >
                        {fmtMoney(amount)}
                      </td>
                      <td style={{ minWidth: 280 }}>{cleanSpaces(row.counterparty)}</td>
                      <td style={{ minWidth: 360 }}>{row.description ?? ""}</td>
                    </tr>
                  );
                })}

                {!filteredTxs.length && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 12 }}>
                      {t("bankingImport.noItemsForFilter")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {batchList.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="cardTitle" style={{ marginBottom: 6 }}>
                {t("bankingImport.recentBatches")}
              </div>
              <div className="actions">
                {batchList.slice(0, 12).map((b: any) => (
                  <button
                    key={b.batch_id}
                    onClick={() => loadBatch(Number(b.batch_id))}
                    className="btn"
                    title={`${t("bankingImport.account")} ${b.bank_account_no}`}
                  >
                    #{b.batch_id} · {t("bankingImport.statementWord")} {b.statement_no} ·{" "}
                    {String(b.statement_date ?? "")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {batchRes && !batchRes.ok && (
        <div className="card" style={{ marginTop: 12, color: "var(--bad)" }}>
          {t("bankingImport.errorLoadingBatch")} {batchRes.error}
        </div>
      )}

        </div>
      </div>
    </div>
  );
}
