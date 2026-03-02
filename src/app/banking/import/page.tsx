"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

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
    if (j.ok) setBatchList(j.batches ?? []);
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
      setImportRes({ ok: false, error: "Odaberi XML fajl." });
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
          error: `Server vratio nešto što nije JSON (HTTP ${r.status}). Prvih 200 znakova: ${text.slice(0, 200)}`,
        });
        return;
      }

      setImportRes(j);

      if (j.ok && j.batch_id) {
        await loadBatch(Number(j.batch_id));
        await loadBatchList();
      }
    } catch (e: any) {
      setImportRes({ ok: false, error: e?.message ?? "Greška" });
    } finally {
      setImporting(false);
    }
  }

  async function runAutoMatch() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      setAutoMatchRes({ ok: false, error: "Nema odabranog batch-a." });
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
          error: `Server vratio nešto što nije JSON (HTTP ${r.status}). Prvih 200 znakova: ${text.slice(0, 200)}`,
        });
        return;
      }

      setAutoMatchRes(j);

      if (j.ok) {
        await loadMatching(bid);
        setView("UNMATCHED");
      }
    } catch (e: any) {
      setAutoMatchRes({ ok: false, error: e?.message ?? "Greška" });
    } finally {
      setAutoMatching(false);
    }
  }

  async function commitBatch() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert("Nema batch-a");
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
        alert(j.error || "Commit greška");
        return;
      }

      alert(
        `✅ Commit OK · committed ${j.committed}/${j.matched_count} (skipped ${j.skipped_already_committed})`,
      );
    } finally {
      setCommitting(false);
    }
  }

  async function commitToProjectCosts() {
    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert("Nema batch-a");
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
        alert(j.error || "Greška");
        return;
      }

      alert(
        `✅ Troškovi upisani: ${j.inserted}/${j.scanned} (skipped ${j.skipped})`,
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
      alert("Neispravan tx_id");
      return;
    }

    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert("Nema batch-a");
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
        alert(j.error || "Greška pri snimanju");
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
      alert("Upiši tekst pravila (npr. ime partnera ili dio opisa).");
      return;
    }

    const bid = Number(batchRes?.batch?.batch_id);
    if (!Number.isFinite(bid) || bid <= 0) {
      alert("Nema batch-a");
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
        alert(j.error || "Greška pri snimanju pravila");
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
          `Auto-match nije vratio JSON (HTTP ${r2.status}). Prvih 200 znakova: ${text2.slice(0, 200)}`,
        );
        return;
      }

      if (!j2?.ok) {
        alert(j2?.error || "Auto-match greška");
        return;
      }

      await loadMatching(bid);
      setView("UNMATCHED");
      setProjectHits([]);
      alert(
        (j.created ? "✅ Pravilo snimljeno" : "✅ Pravilo već postoji") +
          ` · Auto-match: matched ${j2.matched ?? "?"}/${j2.scanned ?? "?"}`,
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
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
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
          <span className="label">account_id</span>
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
          {importing ? "Importujem..." : "Importuj u staging"}
        </button>

        <button
          onClick={loadBatchList}
          className="btn"
        >
          Osvježi listu batch-eva
        </button>

        <button
          onClick={runAutoMatch}
          disabled={!batchId || autoMatching}
          className={`btn btn--active ${!batchId || autoMatching ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || autoMatching}
          title={!batchId ? "Odaberi batch prvo" : "Primijeni match pravila"}
        >
          {autoMatching ? "Auto-match..." : "Auto-match"}
        </button>

        <button
          onClick={commitBatch}
          disabled={!batchId || committing}
          className={`btn ${!batchId || committing ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || committing}
          title={
            !batchId
              ? "Odaberi batch prvo"
              : "Upiši matched stavke u bank_tx_posting (ledger)"
          }
        >
          {committing ? "Commit..." : "Commit batch"}
        </button>

        <button
          onClick={commitToProjectCosts}
          disabled={!batchId || costing}
          className={`btn ${!batchId || costing ? "btn--disabled" : ""}`}
          aria-disabled={!batchId || costing}
          title={
            !batchId
              ? "Odaberi batch prvo"
              : "Upiši postings (bank_tx_posting) u projektne troškove"
          }
        >
          {costing ? "To Costs..." : "To project costs"}
        </button>
      </div>

      {/* Import result */}
      {importRes && (
        <div className="card" style={{ marginTop: 12 }}>
          {importRes.ok ? (
            <>
              <div style={{ fontWeight: 800 }}>✅ Import OK</div>
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
                ❌ Import greška
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
              <div style={{ fontWeight: 800 }}>✅ Auto-match OK</div>
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
                ❌ Auto-match greška
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
              <div style={{ fontWeight: 900 }}>✅ Commit OK</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                committed <b>{commitRes.committed}</b> / matched{" "}
                <b>{commitRes.matched_count}</b> · skipped{" "}
                <b>{commitRes.skipped_already_committed}</b>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--bad)" }}>
              <div style={{ fontWeight: 900 }}>❌ Commit greška</div>
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
                ✅ Troškovi upisani u projektni_troskovi
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
                  errors: {costRes.errors.length} (pogledaj JSON u response)
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--bad)" }}>
              <div style={{ fontWeight: 900 }}>❌ Greška</div>
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
                Batch #{batchRes.batch.batch_id} — izvod{" "}
                {batchRes.batch.statement_no} ({batchRes.batch.statement_date})
              </div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
                Račun: <b>{batchRes.batch.bank_account_no}</b> · Firma:{" "}
                <b>{batchRes.batch.company_name}</b>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14 }}>
                Stari saldo:{" "}
                <b>{fmtMoney(Number(batchRes.batch.opening_balance))}</b>
              </div>
              <div style={{ fontSize: 14 }}>
                Novi saldo:{" "}
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
                  ? "Sve"
                  : k === "FEES"
                    ? "Provizije"
                    : k === "EXCH"
                      ? "Konverzija"
                      : k === "IN"
                        ? "Uplate"
                        : "Isplate"}
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
              Unmatched (
              {unmatchedRes?.ok ? unmatchedRes.unmatched.length : "?"})
            </button>

            <button
              onClick={() => setView("MATCHED")}
              className={`btn ${view === "MATCHED" ? "btn--active" : ""}`}
            >
              Matched ({matchedRes?.ok ? matchedRes.matched.length : "?"})
            </button>
            </div>

            <button
              onClick={() => batchId && loadMatching(batchId)}
              className="btn"
            >
              Refresh match list
            </button>
          </div>

          {view === "UNMATCHED" && (
            <div style={{ marginTop: 12 }}>
              {!unmatchedRes ? (
                <div style={{ opacity: 0.7 }}>
                  Nema podataka (učitaj batch).
                </div>
              ) : !unmatchedRes.ok ? (
                <div style={{ color: "var(--bad)" }}>
                  Greška: {unmatchedRes.error}
                </div>
              ) : (
                <div className="tableCard table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Ref</th>
                        <th style={{ textAlign: "right" }}>Iznos</th>
                        <th>Partner</th>
                        <th>Opis</th>
                        <th>Akcija</th>
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
                                Ručni match
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {!unmatchedRes.unmatched.length && (
                        <tr>
                          <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                            Nema unmatched stavki 🎉
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
                  Nema podataka (učitaj batch).
                </div>
              ) : !matchedRes.ok ? (
                <div style={{ color: "var(--bad)" }}>
                  Greška: {matchedRes.error}
                </div>
              ) : (
                <div className="tableCard table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th style={{ textAlign: "right" }}>Iznos</th>
                        <th>Partner</th>
                        <th>Opis</th>
                        <th>Kategorija</th>
                        <th>Matched</th>
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
                            Nema matched stavki.
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
            Raw stavke iz staginga (preview) ({filteredTxs.length} /{" "}
            {txs.length})
          </div>

          <div className="tableCard table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Ref</th>
                  <th style={{ textAlign: "right" }}>Iznos</th>
                  <th>Kome / Od koga</th>
                  <th>Opis</th>
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
                      Nema stavki za odabrani filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {batchList.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="cardTitle" style={{ marginBottom: 6 }}>
                Zadnji batch-evi
              </div>
              <div className="actions">
                {batchList.slice(0, 12).map((b: any) => (
                  <button
                    key={b.batch_id}
                    onClick={() => loadBatch(Number(b.batch_id))}
                    className="btn"
                    title={`Račun ${b.bank_account_no}`}
                  >
                    #{b.batch_id} · izvod {b.statement_no} ·{" "}
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
          Greška pri učitavanju batch-a: {batchRes.error}
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
              <h3 className="modalTitleText">Ručni match</h3>
            </div>

            <div className="modalBody">

            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <b>{fmtMoney(Number(manualTx.amount))}</b> ·{" "}
              {cleanSpaces(manualTx.counterparty)}
            </div>
            <div style={{ marginBottom: 12 }}>{manualTx.description}</div>

            {/* Projekat search */}
            <label className="field">
              <span className="label">Projekat (upiši broj ili naziv)</span>
              <input
                value={projectQuery}
                onChange={(e) => onProjectQueryChange(e.target.value)}
                placeholder="npr. 123 ili 'kampanja'"
                className="input"
              />

              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                Odabrani projekat:{" "}
                <b>
                  {manualTx.projekat_id
                    ? `#${manualTx.projekat_id}`
                    : "— bez projekta —"}
                </b>
              </div>

              {projectLoading && (
                <div style={{ marginTop: 6, fontSize: 13 }}>Tražim...</div>
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
                  Bez projekta
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
                  title="Ako si upisao broj, postavi ga kao projekat_id"
                >
                  Postavi broj iz inputa
                </button>
              </div>
            </label>

            {/* kategorija */}
            <label className="field">
              <span className="label">Kategorija</span>
              <input
                value={manualTx.kategorija ?? ""}
                onChange={(e) =>
                  setManualTx({ ...manualTx, kategorija: e.target.value })
                }
                placeholder="npr. GORIVO"
                className="input"
              />
            </label>

            {/* Save as rule */}
            <label className="field">
              <span className="label">Save as rule (tekst za prepoznavanje)</span>
              <input
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                placeholder="npr. AERO CENTAR KRILA ili EXCH KONVERZIJA"
                className="input"
              />
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Savjet: za partnere koristi dio imena (npr. “AERO CENTAR”), za
                konverziju “EXCH”, za interne prenose “PRENOS”.
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
                {savingRule ? "Snima rule..." : "Save as rule"}
              </button>

              <button
                onClick={() => {
                  setManualTx(null);
                  resetProjectSearch();
                }}
                className="btn"
              >
                Otkaži
              </button>

              <button
                onClick={saveManualMatch}
                disabled={savingManual}
                className={`btn btn--active ${savingManual ? "btn--disabled" : ""}`}
                aria-disabled={savingManual}
              >
                {savingManual ? "Snima..." : "Sačuvaj (MANUAL)"}
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
