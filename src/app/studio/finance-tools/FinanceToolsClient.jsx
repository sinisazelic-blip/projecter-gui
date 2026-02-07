"use client";

import { useEffect, useMemo, useState } from "react";

const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
};

export default function FinanceToolsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Quick actions inputs
  const [defaultProjectId, setDefaultProjectId] = useState("1"); // overhead by default
  const [note, setNote] = useState("");
  const [deactLinkId, setDeactLinkId] = useState("");

  const incoming = useMemo(() => rows.filter((r) => Number(r.amount) > 0), [rows]);
  const outgoing = useMemo(() => rows.filter((r) => Number(r.amount) < 0), [rows]);

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/finance/postings/unlinked", { cache: "no-store" });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to load unlinked");
      setRows(j.rows || []);
    } catch (e) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function linkPayment(posting) {
    setErr("");
    try {
      const amountAbs = Math.abs(Number(posting.amount));
      const body = {
        posting_id: Number(posting.posting_id),
        amount_km: amountAbs,
        datum: String(posting.value_date),
        napomena: note || `Payment link for posting ${posting.posting_id}`,
        referenca: `posting_id=${posting.posting_id}`,
      };

      const res = await fetch("/api/finance/postings/link-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Link payment failed");

      await refresh();
    } catch (e) {
      setErr(e?.message ?? "Error");
    }
  }

  async function linkIncome(posting) {
    setErr("");
    try {
      const pid = Number(defaultProjectId);
      if (!Number.isFinite(pid) || pid <= 0) throw new Error("projekat_id mora biti broj > 0");

      const body = {
        posting_id: Number(posting.posting_id),
        amount_km: Number(posting.amount),
        datum: String(posting.value_date),
        projekat_id: pid,
        opis: note || `Income link for posting ${posting.posting_id}`,
      };

      const res = await fetch("/api/finance/postings/link-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Link income failed");

      await refresh();
    } catch (e) {
      setErr(e?.message ?? "Error");
    }
  }

  async function deactivatePaymentLink() {
    setErr("");
    try {
      const link_id = Number(deactLinkId);
      if (!Number.isFinite(link_id) || link_id <= 0) throw new Error("link_id mora biti broj > 0");

      const res = await fetch("/api/finance/postings/deactivate-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Deactivate failed");

      setDeactLinkId("");
      await refresh();
    } catch (e) {
      setErr(e?.message ?? "Error");
    }
  }

  return (
    <>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 180 }}>
            <div className="label">Default projekat_id (za INCOME)</div>
            <input
              className="input"
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
              placeholder="1"
            />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="label">Napomena/Opis (opcionalno)</div>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Npr. Bank provizija / Posudba vlasnika / UIO..."
            />
          </div>

          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Učitavam..." : "Osvježi"}
          </button>
        </div>

        {err ? (
          <div className="badge badge-red" style={{ marginTop: 10 }}>
            Greška: {err}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Deaktivacija payment linka (storno)</div>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 200 }}>
            <div className="label">link_id</div>
            <input
              className="input"
              value={deactLinkId}
              onChange={(e) => setDeactLinkId(e.target.value)}
              placeholder="npr. 6"
            />
          </div>
          <button className="btn btn-danger" onClick={deactivatePaymentLink}>
            Deaktiviraj link
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">UNLINKED bank postings</div>
        <div className="card-subtitle">
          Incoming (amount &gt; 0) → LINK INCOME. Outgoing (amount &lt; 0) → LINK PAY.
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="badge">Incoming: {incoming.length}</div>{" "}
          <div className="badge">Outgoing: {outgoing.length}</div>{" "}
          <div className="badge">Total: {rows.length}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Datum</th>
                <th>Iznos</th>
                <th>Partner</th>
                <th>Opis</th>
                <th style={{ width: 240 }}>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.8 }}>
                    Nema unlinked posting-a. ✅
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const amt = Number(r.amount);
                  const isIncoming = amt > 0;
                  const isOutgoing = amt < 0;

                  return (
                    <tr key={r.posting_id}>
                      <td>{r.posting_id}</td>
                      <td>{r.value_date}</td>
                      <td>{fmt(r.amount)} {r.currency || ""}</td>
                      <td style={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.counterparty || "—"}
                      </td>
                      <td style={{ maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.description || "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btn"
                            disabled={!isOutgoing}
                            title={isOutgoing ? "Link kao payment" : "Samo outgoing može biti payment"}
                            onClick={() => linkPayment(r)}
                          >
                            LINK PAY
                          </button>
                          <button
                            className="btn"
                            disabled={!isIncoming}
                            title={isIncoming ? "Link kao income" : "Samo incoming može biti income"}
                            onClick={() => linkIncome(r)}
                          >
                            LINK INCOME
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
