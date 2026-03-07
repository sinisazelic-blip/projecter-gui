"use client";

import React, { useMemo, useRef, useState } from "react";
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

type MatchListResponse = {
  ok: boolean;
  batch_id: number;
  matched: any[];
  error?: string;
};

type UnmatchedResponse = {
  ok: boolean;
  batch_id: number;
  unmatched: any[];
  error?: string;
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
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState<ImportResponse | null>(null);

  // batch
  const [batchRes, setBatchRes] = useState<BatchResponse | null>(null);
  const [batchList, setBatchList] = useState<any[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FEES" | "EXCH" | "IN" | "OUT">(
    "ALL",
  );

  // matching view
  const [view, setView] = useState<"UNMATCHED" | "MATCHED">("UNMATCHED");
  const [unmatchedRes, setUnmatchedRes] = useState<UnmatchedResponse | null>(
    null,
  );
  const [matchedRes, setMatchedRes] = useState<MatchListResponse | null>(null);

  // auto-match
  const [autoMatchRes, setAutoMatchRes] = useState<AutoMatchResponse | null>(
    null,
  );
  const [autoMatching, setAutoMatching] = useState(false);

  // manual match modal
  const [manualTx, setManualTx] = useState<any | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  // project search (autocomplete)
  const [projectQuery, setProjectQuery] = useState("");
  const [projectHits, setProjectHits] = useState<any[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const searchTimerRef = useRef<any>(null);

  // Save as rule (C)
  const [ruleText, setRuleText] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  // Commit batch (2.3)
  const [committing, setCommitting] = useState(false);
  const [commitRes, setCommitRes] = useState<any | null>(null);

  // To project costs (3)
  const [costing, setCosting] = useState(false);
  const [costRes, setCostRes] = useState<any | null>(null);

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

  async function loadMatching(batch_id: number) {
    const [u, m] = await Promise.all([
      fetch(`/api/bank/match/unmatched?batch_id=${batch_id}`, {
        cache: "no-store",
      }).then((x) => x.json()),
      fetch(`/api/bank/match/list?batch_id=${batch_id}`, {
        cache: "no-store",
      }).then((x) => x.json()),
    ]);
    setUnmatchedRes(u);
    setMatchedRes(m);
  }

  async function loadBatch(id: number) {
    const r = await fetch(`/api/bank/batch?id=${id}`, { cache: "no-store" });
    const j: BatchResponse = await r.json();
    setBatchRes(j);

    if (j.ok && j.batch?.batch_id) {
      await loadMatching(Number(j.batch.batch_id));
    }
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

      const r = await fetch("/api/bank/import/xml-v2", {
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
        await loadMatching(bid);
        setView("UNMATCHED");
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

      alert(
        `✅ ${t("bankingImport.commitOk")} · committed ${j.committed}/${j.matched_count} (skipped ${j.skipped_already_committed})`,
      );
    } finally {
      setCommitting(false);
    }
  }

  async function commitToProjectCosts() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert(t("bankingImport.noBatch"));
      return;
    }

    setCosting(true);
    setCostRes(null);

    try {
      const r = await fetch("/api/bank/costs/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: bid }),
      });

      const j = await r.json();
      setCostRes(j);

      if (!j.ok) {
        alert(j.error || t("bankingImport.error"));
        return;
      }

      alert(
        `✅ ${t("bankingImport.costsWritten")}: ${j.inserted}/${j.scanned} (skipped ${j.skipped})`,
      );
    } finally {
      setCosting(false);
    }
  }

  function resetProjectSearch() {
    setProjectQuery("");
    setProjectHits([]);
    setProjectLoading(false);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }

  async function doProjectSearch(q: string) {
    const qq = q.trim();
    if (!qq) {
      setProjectHits([]);
      setProjectLoading(false);
      return;
    }

    setProjectLoading(true);
    try {
      const r = await fetch(
        `/api/projects/search?q=${encodeURIComponent(qq)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (j?.success) setProjectHits(j.data ?? []);
      else setProjectHits([]);
    } catch {
      setProjectHits([]);
    } finally {
      setProjectLoading(false);
    }
  }

  function onProjectQueryChange(v: string) {
    setProjectQuery(v);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      doProjectSearch(v);
    }, 250);
  }

  async function openManualMatch(tx: any) {
    const cp = cleanSpaces(tx?.counterparty);
    const desc = cleanSpaces(tx?.description);

    setManualTx({
      ...tx,
      projekat_id: tx?.projekat_id ? String(tx.projekat_id) : "",
      kategorija: tx?.kategorija ? String(tx.kategorija) : "",
    });

    setRuleText((cp && cp.length >= 4 ? cp : desc).slice(0, 120));

    resetProjectSearch();
  }

  async function saveManualMatch() {
    if (!manualTx) return;

    const tx_id = Number(manualTx.tx_id);
    if (!Number.isFinite(tx_id) || tx_id <= 0) {
      alert(t("bankingImport.invalidTxId"));
      return;
    }

    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert(t("bankingImport.noBatch"));
      return;
    }

    setSavingManual(true);
    try {
      const r = await fetch("/api/bank/match/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_id,
          projekat_id: manualTx.projekat_id
            ? Number(manualTx.projekat_id)
            : null,
          kategorija: String(manualTx.kategorija || "").trim() || null,
        }),
      });

      const j = await r.json();
      if (!j.ok) {
        alert(j.error || t("bankingImport.errorSaving"));
        return;
      }

      await loadMatching(bid);
      setManualTx(null);
      setView("UNMATCHED");
      resetProjectSearch();
    } finally {
      setSavingManual(false);
    }
  }

  async function saveRuleFromModal() {
    if (!manualTx) return;

    const match_text = String(ruleText || "").trim();
    if (!match_text) {
      alert(t("bankingImport.enterRuleText"));
      return;
    }

    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert(t("bankingImport.noBatch"));
      return;
    }

    setSavingRule(true);
    try {
      const r = await fetch("/api/bank/match/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_text,
          match_is_fee: Number(manualTx.is_fee) === 1,
          projekat_id: manualTx.projekat_id
            ? Number(manualTx.projekat_id)
            : null,
          kategorija: String(manualTx.kategorija || "").trim() || null,
          priority: 50,
        }),
      });

      const j = await r.json();
      if (!j.ok) {
        alert(j.error || t("bankingImport.errorSavingRule"));
        return;
      }

      const r2 = await fetch(`/api/bank/match/auto?batch_id=${bid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const text2 = await r2.text();
      let j2: any = null;
      try {
        j2 = JSON.parse(text2);
      } catch {
        alert(
          `${t("bankingImport.autoMatchNoJson")} (HTTP ${r2.status}). Prvih 200 znakova: ${text2.slice(0, 200)}`,
        );
        return;
      }

      if (!j2?.ok) {
        alert(j2?.error || t("bankingImport.autoMatchError"));
        return;
      }

      await loadMatching(bid);
      setView("UNMATCHED");
      setProjectHits([]);
      alert(
        (j.created ? `✅ ${t("bankingImport.ruleSaved")}` : `✅ ${t("bankingImport.ruleExists")}`) +
          ` · ${t("bankingImport.autoMatchResult")}: matched ${j2.matched ?? "?"}/${j2.scanned ?? "?"}`,
      );

      setManualTx(null);
      resetProjectSearch();
    } finally {
      setSavingRule(false);
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
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("bankingImport.title")}</div>
                  <div className="brandSub">{t("bankingImport.subtitle")}</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                🏠 {t("common.dashboard")}
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      {/* Import bar */}
      <div className="actions">
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
          style={{ width: "auto", minWidth: 200 }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="label">{t("bankingImport.accountId")}</span>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="input small"
            style={{ width: 80 }}
          />
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
          onClick={runAutoMatch}
          disabled={!batchId || autoMatching}
          className={`btn btn--active ${!batchId || autoMatching ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || autoMatching}
          title={!batchId ? t("bankingImport.selectBatchFirst") : t("bankingImport.applyMatchRules")}
        >
          {autoMatching ? t("bankingImport.autoMatching") : t("bankingImport.autoMatch")}
        </button>

        <button
          onClick={commitBatch}
          disabled={!batchId || committing}
          className={`btn ${!batchId || committing ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || committing}
          title={
            !batchId
              ? t("bankingImport.selectBatchFirst")
              : t("bankingImport.writeToLedger")
          }
        >
          {committing ? t("bankingImport.committing") : t("bankingImport.commitBatch")}
        </button>

        <button
          onClick={commitToProjectCosts}
          disabled={!batchId || costing}
          className={`btn ${!batchId || costing ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || costing}
          title={
            !batchId
              ? t("bankingImport.selectBatchFirst")
              : t("bankingImport.writeToCosts")
          }
        >
          {costing ? t("bankingImport.toCosts") : t("bankingImport.toProjectCosts")}
        </button>
      </div>

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
                committed <b>{commitRes.committed}</b> / matched{" "}
                <b>{commitRes.matched_count}</b> · skipped{" "}
                <b>{commitRes.skipped_already_committed}</b>
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

      {/* Costs result */}
      {costRes && (
        <div className="card" style={{ marginTop: 12 }}>
          {costRes.ok ? (
            <div>
              <div style={{ fontWeight: 900 }}>
                ✅ {t("bankingImport.costsWrittenTitle")}
              </div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                inserted <b>{costRes.inserted}</b> / scanned{" "}
                <b>{costRes.scanned}</b> · skipped <b>{costRes.skipped}</b>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                mapping: {JSON.stringify(costRes.mapping)}
              </div>
              {Array.isArray(costRes.errors) && costRes.errors.length > 0 && (
                <div style={{ marginTop: 10, color: "var(--bad)", fontSize: 13 }}>
                  {t("bankingImport.errorsInResponse")}: {costRes.errors.length}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--bad)" }}>
              <div style={{ fontWeight: 900 }}>❌ {t("bankingImport.errorTitle")}</div>
              <div style={{ marginTop: 6 }}>{costRes.error}</div>
              {costRes.debug && (
                <pre
                  style={{
                    marginTop: 10,
                    background: "rgba(255,255,255,0.04)",
                    padding: 10,
                    borderRadius: 10,
                    overflowX: "auto",
                    border: "1px solid var(--border)",
                  }}
                >
                  {JSON.stringify(costRes.debug, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch header */}
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
                {t("bankingImport.account")}: <b>{batchRes.batch.bank_account_no}</b> · {t("bankingImport.company")}:{" "}
                <b>{batchRes.batch.company_name}</b>
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
        </div>
      )}

      {/* Matching tabs */}
      {batchRes?.ok && batchRes.batch && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="tabRow" style={{ justifyContent: "space-between" }}>
            <div className="tabRow">
            <button
              onClick={() => setView("UNMATCHED")}
              className={`btn ${view === "UNMATCHED" ? "btn--active" : ""}`}
            >
              {t("bankingImport.unmatched")} (
              {unmatchedRes?.ok ? unmatchedRes.unmatched.length : "?"})
            </button>

            <button
              onClick={() => setView("MATCHED")}
              className={`btn ${view === "MATCHED" ? "btn--active" : ""}`}
            >
              {t("bankingImport.matched")} ({matchedRes?.ok ? matchedRes.matched.length : "?"})
            </button>
            </div>

            <button
              onClick={() => batchId && loadMatching(batchId)}
              className="btn"
            >
              {t("bankingImport.refreshMatchList")}
            </button>
          </div>

          {view === "UNMATCHED" && (
            <div style={{ marginTop: 12 }}>
              {!unmatchedRes ? (
                <div style={{ opacity: 0.7 }}>
                  {t("bankingImport.noDataLoadBatch")}
                </div>
              ) : !unmatchedRes.ok ? (
                <div style={{ color: "var(--bad)" }}>
                  {t("bankingImport.errorTitle")}: {unmatchedRes.error}
                </div>
              ) : (
                <div className="tableCard table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("bankingImport.colDate")}</th>
                        <th>{t("bankingImport.colRef")}</th>
                        <th style={{ textAlign: "right" }}>{t("bankingImport.colAmount")}</th>
                        <th>{t("bankingImport.colPartner")}</th>
                        <th>{t("bankingImport.colDescription")}</th>
                        <th>{t("bankingImport.colAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatchedRes.unmatched.map((t: any) => {
                        const amount = Number(t.amount);
                        return (
                          <tr key={t.tx_id}>
                            <td className="nowrap">{t.value_date ?? ""}</td>
                            <td className="nowrap">{t.reference ?? ""}</td>
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
                            <td style={{ minWidth: 260 }}>{cleanSpaces(t.counterparty)}</td>
                            <td style={{ minWidth: 340 }}>{t.description ?? ""}</td>
                            <td className="nowrap">
                              <button
                                onClick={() => openManualMatch(t)}
                                className="btn"
                              >
                                {t("bankingImport.manualMatch")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {!unmatchedRes.unmatched.length && (
                        <tr>
                          <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                            {t("bankingImport.noUnmatched")} 🎉
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {view === "MATCHED" && (
            <div style={{ marginTop: 12 }}>
              {!matchedRes ? (
                <div style={{ opacity: 0.7 }}>
                  {t("bankingImport.noDataLoadBatch")}
                </div>
              ) : !matchedRes.ok ? (
                <div style={{ color: "var(--bad)" }}>
                  {t("bankingImport.errorTitle")}: {matchedRes.error}
                </div>
              ) : (
                <div className="tableCard table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("bankingImport.colDate")}</th>
                        <th style={{ textAlign: "right" }}>{t("bankingImport.colAmount")}</th>
                        <th>{t("bankingImport.colPartner")}</th>
                        <th>{t("bankingImport.colDescription")}</th>
                        <th>{t("bankingImport.colCategory")}</th>
                        <th>{t("bankingImport.colMatched")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedRes.matched.map((t: any) => {
                        const amount = Number(t.amount);
                        return (
                          <tr key={t.tx_id}>
                            <td className="nowrap">{t.value_date ?? ""}</td>
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
                            <td style={{ minWidth: 260 }}>{cleanSpaces(t.counterparty)}</td>
                            <td style={{ minWidth: 340 }}>{t.description ?? ""}</td>
                            <td className="nowrap">
                              <b>{t.kategorija ?? ""}</b>
                              {t.projekat_id ? ` (P#${t.projekat_id})` : ""}
                            </td>
                            <td className="nowrap">{t.matched_by} · {t.matched_at}</td>
                          </tr>
                        );
                      })}

                      {!matchedRes.matched.length && (
                        <tr>
                          <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                            {t("bankingImport.noMatched")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Raw tx preview */}
      {batchRes?.ok && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="cardTitle" style={{ marginBottom: 8 }}>
            {t("bankingImport.rawStagingPreview")} ({filteredTxs.length} /{" "}
            {txs.length})
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
                {filteredTxs.map((t: any) => {
                  const amount = Number(t.amount);
                  return (
                    <tr key={t.tx_id}>
                      <td className="nowrap">{t.value_date ?? ""}</td>
                      <td className="nowrap">{t.reference ?? ""}</td>
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
                      <td style={{ minWidth: 280 }}>{cleanSpaces(t.counterparty)}</td>
                      <td style={{ minWidth: 360 }}>{t.description ?? ""}</td>
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

      {/* MANUAL MATCH MODAL */}
      {manualTx && (
        <div
          className="modalOverlay"
          onClick={() => {
            setManualTx(null);
            resetProjectSearch();
          }}
        >
          <div
            className="modalContent"
            style={{ width: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <h3 className="modalTitleText">{t("bankingImport.manualMatchTitle")}</h3>
            </div>

            <div className="modalBody">

            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <b>{fmtMoney(Number(manualTx.amount))}</b> ·{" "}
              {cleanSpaces(manualTx.counterparty)}
            </div>
            <div style={{ marginBottom: 12 }}>{manualTx.description}</div>

            {/* Projekat search */}
            <label className="field">
              <span className="label">{t("bankingImport.projectLabel")}</span>
              <input
                value={projectQuery}
                onChange={(e) => onProjectQueryChange(e.target.value)}
                placeholder={t("bankingImport.projectPlaceholder")}
                className="input"
              />

              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                {t("bankingImport.selectedProject")}{" "}
                <b>
                  {manualTx.projekat_id
                    ? `#${manualTx.projekat_id}`
                    : t("bankingImport.noProject")}
                </b>
              </div>

              {projectLoading && (
                <div style={{ marginTop: 6, fontSize: 13 }}>{t("bankingImport.searching")}</div>
              )}

              {!!projectHits.length && (
                <div className="card" style={{ marginTop: 8 }}>
                  {projectHits.slice(0, 10).map((p: any, idx: number) => (
                    <button
                      key={`${p.projekat_id}-${idx}`}
                      type="button"
                      className="btn"
                      style={{
                        width: "100%",
                        justifyContent: "flex-start",
                        marginBottom: idx < 9 ? 4 : 0,
                      }}
                      onClick={() => {
                        setManualTx({
                          ...manualTx,
                          projekat_id: String(p.projekat_id),
                        });
                        setProjectQuery(
                          `#${p.projekat_id} — ${String(p.radni_naziv ?? "").slice(0, 60)}`,
                        );
                        setProjectHits([]);
                      }}
                    >
                      <b>#{p.projekat_id}</b>{" "}
                      <span style={{ opacity: 0.85 }}>
                        — {String(p.radni_naziv ?? "").slice(0, 80)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setManualTx({ ...manualTx, projekat_id: "" });
                    resetProjectSearch();
                  }}
                  className="btn"
                >
                  {t("bankingImport.noProjectBtn")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const onlyNum = projectQuery.replace(/[^0-9]/g, "").trim();
                    if (onlyNum)
                      setManualTx({ ...manualTx, projekat_id: onlyNum });
                    setProjectHits([]);
                  }}
                  className="btn"
                  title={t("bankingImport.setNumberFromInput")}
                >
                  {t("bankingImport.setNumberFromInput")}
                </button>
              </div>
            </label>

            {/* kategorija */}
            <label className="field">
              <span className="label">{t("bankingImport.category")}</span>
              <input
                value={manualTx.kategorija ?? ""}
                onChange={(e) =>
                  setManualTx({ ...manualTx, kategorija: e.target.value })
                }
                placeholder={t("bankingImport.categoryPlaceholder")}
                className="input"
              />
            </label>

            {/* Save as rule */}
            <label className="field">
              <span className="label">{t("bankingImport.saveAsRuleLabel")}</span>
              <input
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                placeholder={t("bankingImport.saveAsRulePlaceholder")}
                className="input"
              />
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                {t("bankingImport.saveAsRuleHint")}
              </div>
            </label>

            </div>

            <div className="modalFooter">
              <button
                onClick={saveRuleFromModal}
                disabled={savingRule}
                className={`btn btn--active ${savingRule ? "btn--disabled" : ""}`}
                aria-disabled={savingRule}
              >
                {savingRule ? t("bankingImport.savingRule") : t("bankingImport.saveAsRule")}
              </button>

              <button
                onClick={() => {
                  setManualTx(null);
                  resetProjectSearch();
                }}
                className="btn"
              >
                {t("bankingImport.cancel")}
              </button>

              <button
                onClick={saveManualMatch}
                disabled={savingManual}
                className={`btn btn--active ${savingManual ? "btn--disabled" : ""}`}
                aria-disabled={savingManual}
              >
                {savingManual ? t("bankingImport.saving") : t("bankingImport.saveManual")}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
