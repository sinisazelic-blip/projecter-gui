"use client";

import React, { useEffect, useState } from "react";

type Batch = {
  batch_id: number;
  account_id: number | null;
  status: string;
};

type BatchStats = {
  staging: number;
  matched: number;
  postings: number;
  cost_links: number;
};

export default function BankPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [stats, setStats] = useState<Record<number, BatchStats>>({});
  const [busy, setBusy] = useState<Record<number, string>>({}); // batch_id -> action

  async function loadBatches() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/bank/batches?limit=50", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error ?? "Failed to load batches");
      const list: Batch[] = Array.isArray(json.batches) ? json.batches : [];
      setBatches(list);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(batch_id: number) {
    try {
      const res = await fetch(`/api/bank/batches/stats?batch_id=${batch_id}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error ?? "Failed to load stats");
      setStats((s) => ({ ...s, [batch_id]: json.counts as BatchStats }));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    // auto-load stats for visible list (first 15)
    batches.slice(0, 15).forEach((b) => loadStats(b.batch_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  async function doAction(
    batch_id: number,
    action: "apply" | "commit" | "costs",
  ) {
    setBusy((x) => ({ ...x, [batch_id]: action }));
    setErr(null);
    try {
      if (action === "apply") {
        const res = await fetch("/api/bank/match/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_id }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json?.error ?? "Apply failed");
      }

      if (action === "commit") {
        const res = await fetch("/api/bank/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_id }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok)
          throw new Error(json?.error ?? "Commit failed");
      }

      if (action === "costs") {
        const res = await fetch("/api/bank/costs/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_id, tip_id_default: 1 }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok)
          throw new Error(json?.error ?? "Costs commit failed");
      }

      // refresh list + stats
      await loadBatches();
      await loadStats(batch_id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy((x) => {
        const { [batch_id]: _, ...rest } = x;
        return rest;
      });
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bank</h1>
          <p className="text-sm text-gray-500">
            Batches: Apply rules → Commit → Costs
          </p>
        </div>

        <div className="flex gap-2">
          <a
            className="px-3 py-2 rounded border hover:bg-gray-50"
            href="/bank/rules"
          >
            Rules
          </a>
          <button
            className="px-3 py-2 rounded border hover:bg-gray-50"
            onClick={loadBatches}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {err}
        </div>
      ) : null}

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2 border-b">batch_id</th>
              <th className="p-2 border-b">status</th>
              <th className="p-2 border-b">account</th>
              <th className="p-2 border-b">staging</th>
              <th className="p-2 border-b">matched</th>
              <th className="p-2 border-b">postings</th>
              <th className="p-2 border-b">cost_links</th>
              <th className="p-2 border-b">actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={8}>
                  No batches.
                </td>
              </tr>
            ) : (
              batches.map((b) => {
                const s = stats[b.batch_id];
                const isBusy = !!busy[b.batch_id];
                return (
                  <tr key={b.batch_id} className="border-t">
                    <td className="p-2 font-medium">#{b.batch_id}</td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded bg-gray-100">
                        {b.status}
                      </span>
                    </td>
                    <td className="p-2">{b.account_id ?? "—"}</td>
                    <td className="p-2">{s ? s.staging : "…"}</td>
                    <td className="p-2">{s ? s.matched : "…"}</td>
                    <td className="p-2">{s ? s.postings : "…"}</td>
                    <td className="p-2">{s ? s.cost_links : "…"}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => doAction(b.batch_id, "apply")}
                        >
                          {busy[b.batch_id] === "apply"
                            ? "Applying..."
                            : "Apply"}
                        </button>
                        <button
                          className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => doAction(b.batch_id, "commit")}
                        >
                          {busy[b.batch_id] === "commit"
                            ? "Committing..."
                            : "Commit"}
                        </button>
                        <button
                          className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => doAction(b.batch_id, "costs")}
                        >
                          {busy[b.batch_id] === "costs"
                            ? "Costing..."
                            : "Costs"}
                        </button>
                        <button
                          className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => loadStats(b.batch_id)}
                        >
                          Stats
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

      <div className="text-xs text-gray-500">
        Tip: normalni redoslijed je <b>Apply</b> → <b>Commit</b> → <b>Costs</b>.
        Ako batch već ima match, Apply će biti 0 i to je OK.
      </div>
    </div>
  );
}
