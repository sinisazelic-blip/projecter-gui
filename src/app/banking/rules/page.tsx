"use client";

import React, { useEffect, useMemo, useState } from "react";

type Rule = {
  rule_id: number;
  priority: number;
  is_active: 0 | 1;
  match_text: string | null;
  match_account: string | null;
  match_amount: string | number | null;
  match_is_fee: 0 | 1 | null;
  projekat_id: number | null;
  narucilac_id: number | null;
  kategorija: string | null;
  created_at: string;
};

type PreviewRow = {
  tx_id: number;
  value_date: string | null;
  amount: string | number;
  currency: string | null;
  counterparty: string | null;
  description: string | null;
};

type ApplyResult = {
  ok: boolean;
  batch_id: number;
  dry_run: boolean;
  rules_active: number;
  total_candidates: number;
  updated_rows: number;
  inserted_rows: number;
  match_rows_for_batch: number;
  per_rule: any[];
  marker?: string;
  error?: string;
};

function asNumOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function asStrOrNull(v: string) {
  const t = v.trim();
  return t ? t : null;
}

const emptyDraft = (): Partial<Rule> => ({
  priority: 100,
  is_active: 1,
  match_text: null,
  match_account: null,
  match_amount: null,
  match_is_fee: null,
  projekat_id: null,
  narucilac_id: null,
  kategorija: null,
});

export default function BankRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<Rule>>(emptyDraft());
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

  // Preview (single rule)
  const [previewBatchId, setPreviewBatchId] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<PreviewRow[]>([]);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  // Apply Rules (whole batch)
  const [applyBatchId, setApplyBatchId] = useState<string>("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyRes, setApplyRes] = useState<ApplyResult | null>(null);

  const selectedRule = useMemo(
    () => rules.find((r) => r.rule_id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rules.filter((r) => {
      if (!showInactive && r.is_active !== 1) return false;
      if (!qq) return true;
      const hay = [
        r.rule_id,
        r.priority,
        r.match_text ?? "",
        r.match_account ?? "",
        r.match_amount ?? "",
        r.kategorija ?? "",
        r.projekat_id ?? "",
        r.narucilac_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [rules, q, showInactive]);

  async function loadRules() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/bank/rules", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Failed to load rules");
      const list: Rule[] = Array.isArray(json.rules) ? json.rules : [];
      setRules(list);
      if (selectedRuleId === null && list.length) setSelectedRuleId(list[0].rule_id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditingRuleId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingRuleId(rule.rule_id);
    setDraft({ ...rule });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setDraft(emptyDraft());
    setEditingRuleId(null);
  }

  async function saveRule() {
    setSaving(true);
    setErr(null);

    try {
      const payload = {
        priority: Number(draft.priority ?? 100),
        is_active: (draft.is_active ?? 1) ? true : false,
        match_text: draft.match_text ?? null,
        match_account: draft.match_account ?? null,
        match_amount: draft.match_amount === "" ? null : draft.match_amount ?? null,
        match_is_fee:
          draft.match_is_fee === null || draft.match_is_fee === undefined
            ? null
            : Number(draft.match_is_fee) === 1,
        projekat_id: draft.projekat_id ?? null,
        narucilac_id: draft.narucilac_id ?? null,
        kategorija: draft.kategorija ?? null,
      };

      let res: Response;
      if (editingRuleId) {
        res = await fetch(`/api/bank/rules/${editingRuleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/bank/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Save failed");

      await loadRules();
      const newId = editingRuleId ?? json?.rule?.rule_id ?? null;
      if (newId) setSelectedRuleId(Number(newId));
      closeModal();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule_id: number) {
    // eslint-disable-next-line no-alert
    if (!confirm(`Obrisati rule #${rule_id}?`)) return;
    setErr(null);
    try {
      const res = await fetch(`/api/bank/rules/${rule_id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Delete failed");
      await loadRules();
      if (selectedRuleId === rule_id) setSelectedRuleId(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function runPreview(ruleOverride?: Partial<Rule>) {
    setPreviewLoading(true);
    setPreviewErr(null);
    setPreviewCount(null);
    setPreviewSample([]);

    try {
      const batch_id = asNumOrNull(previewBatchId);
      const body: any = {};
      if (batch_id) body.batch_id = batch_id;

      if (ruleOverride) {
        body.rule = {
          match_text: ruleOverride.match_text ?? null,
          match_account: ruleOverride.match_account ?? null,
          match_amount:
            ruleOverride.match_amount === "" || ruleOverride.match_amount === undefined
              ? null
              : ruleOverride.match_amount ?? null,
          match_is_fee:
            ruleOverride.match_is_fee === null || ruleOverride.match_is_fee === undefined
              ? null
              : Number(ruleOverride.match_is_fee),
          projekat_id: ruleOverride.projekat_id ?? null,
          narucilac_id: ruleOverride.narucilac_id ?? null,
          kategorija: ruleOverride.kategorija ?? null,
          priority: Number(ruleOverride.priority ?? 100),
          is_active: Number(ruleOverride.is_active ?? 1),
        };
      } else if (selectedRuleId) {
        body.rule_id = selectedRuleId;
      } else {
        throw new Error("Odaberi rule za preview.");
      }

      const res = await fetch("/api/bank/rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Preview failed");

      setPreviewCount(Number(json.count ?? 0));
      setPreviewSample(Array.isArray(json.sample) ? json.sample : []);
    } catch (e: any) {
      setPreviewErr(e?.message ?? String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function applyRules(dryRun: boolean) {
    setApplyLoading(true);
    setApplyErr(null);
    setApplyRes(null);

    try {
      const bid = asNumOrNull(applyBatchId);
      if (!bid) throw new Error("Unesi batch_id za apply.");

      const res = await fetch("/api/bank/match/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: bid, dry_run: dryRun }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Apply failed");

      setApplyRes(json as ApplyResult);
    } catch (e: any) {
      setApplyErr(e?.message ?? String(e));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bank Rules</h1>
          <p className="text-sm text-gray-500">
            CRUD + preview + apply rules na batch.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded border hover:bg-gray-50" onClick={loadRules} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button className="px-3 py-2 rounded bg-black text-white" onClick={openCreate}>
            + New rule
          </button>
        </div>
      </div>

      {err ? <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{err}</div> : null}

      {/* Apply rules panel */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Apply rules to batch</h2>
            <p className="text-sm text-gray-500">
              Poziva <code className="px-1 py-0.5 rounded bg-gray-100">/api/bank/match/apply</code>.
              Ne pregazi ručni match (samo NULL ili rule).
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <input
              className="w-40 px-3 py-2 rounded border"
              placeholder="batch_id"
              value={applyBatchId}
              onChange={(e) => setApplyBatchId(e.target.value)}
            />
            <button
              className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              disabled={applyLoading}
              onClick={() => applyRules(true)}
            >
              {applyLoading ? "..." : "Preview apply"}
            </button>
            <button
              className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
              disabled={applyLoading}
              onClick={() => applyRules(false)}
            >
              {applyLoading ? "..." : "Apply"}
            </button>
          </div>
        </div>

        {applyErr ? (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{applyErr}</div>
        ) : null}

        {applyRes ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-gray-500">Batch</div>
              <div className="font-medium">#{applyRes.batch_id}</div>
              <div className="text-gray-600">dry_run: {applyRes.dry_run ? "true" : "false"}</div>
              <div className="text-gray-600">rules_active: {applyRes.rules_active}</div>
              <div className="text-gray-600">marker: {applyRes.marker ?? "—"}</div>
            </div>

            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-gray-500">Result</div>
              <div className="text-gray-700">candidates: {applyRes.total_candidates}</div>
              <div className="text-gray-700">updated: {applyRes.updated_rows}</div>
              <div className="text-gray-700">inserted: {applyRes.inserted_rows}</div>
              <div className="text-gray-700">match_rows_for_batch: {applyRes.match_rows_for_batch}</div>
            </div>

            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-gray-500">Per rule</div>
              <div className="text-gray-600">Prikaz prvih 8 (u konzoli vidiš sve).</div>
              <ul className="mt-1 space-y-1">
                {applyRes.per_rule?.slice(0, 8)?.map((r: any) => (
                  <li key={r.rule_id} className="text-gray-700">
                    #{r.rule_id} prio {r.priority}: cand {r.candidates}, upd {r.updated}, ins {r.inserted}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: rules list */}
        <div className="lg:col-span-1 border rounded-lg overflow-hidden">
          <div className="p-3 border-b bg-gray-50 space-y-2">
            <input className="w-full px-3 py-2 rounded border bg-white" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No rules.</div>
            ) : (
              <ul className="divide-y">
                {filtered.map((r) => (
                  <li
                    key={r.rule_id}
                    className={[
                      "p-3 cursor-pointer hover:bg-gray-50",
                      selectedRuleId === r.rule_id ? "bg-gray-50" : "",
                    ].join(" ")}
                    onClick={() => setSelectedRuleId(r.rule_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        #{r.rule_id} <span className="text-xs text-gray-500">prio {r.priority}</span>
                      </div>
                      <span className={["text-xs px-2 py-1 rounded", r.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"].join(" ")}>
                        {r.is_active ? "active" : "inactive"}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                      <div>text: {r.match_text ?? "—"}</div>
                      <div>amount: {r.match_amount ?? "—"}</div>
                      <div>kategorija: {r.kategorija ?? "—"}</div>
                      <div>projekat_id: {r.projekat_id ?? "—"} | narucilac_id: {r.narucilac_id ?? "—"}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: details + preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Rule details</h2>
                <p className="text-sm text-gray-500">Odaberi rule lijevo.</p>
              </div>

              <div className="flex gap-2">
                <button className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={!selectedRule} onClick={() => selectedRule && openEdit(selectedRule)}>
                  Edit
                </button>
                <button className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={!selectedRule} onClick={() => selectedRule && deleteRule(selectedRule.rule_id)}>
                  Delete
                </button>
              </div>
            </div>

            {!selectedRule ? (
              <div className="mt-4 text-sm text-gray-500">Nije odabran nijedan rule.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Rule</div>
                  <div className="font-medium">#{selectedRule.rule_id}</div>
                  <div className="text-gray-600">priority: {selectedRule.priority}</div>
                  <div className="text-gray-600">active: {selectedRule.is_active ? "yes" : "no"}</div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Match inputs</div>
                  <div className="text-gray-700">match_text: {selectedRule.match_text ?? "—"}</div>
                  <div className="text-gray-700">match_amount: {selectedRule.match_amount ?? "—"}</div>
                  <div className="text-gray-700">
                    match_is_fee:{" "}
                    {selectedRule.match_is_fee === null ? "—" : selectedRule.match_is_fee ? "true" : "false"}
                  </div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Outputs</div>
                  <div className="text-gray-700">projekat_id: {selectedRule.projekat_id ?? "—"}</div>
                  <div className="text-gray-700">narucilac_id: {selectedRule.narucilac_id ?? "—"}</div>
                  <div className="text-gray-700">kategorija: {selectedRule.kategorija ?? "—"}</div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Created</div>
                  <div className="text-gray-700">{selectedRule.created_at}</div>
                </div>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Preview (single rule)</h2>
                <p className="text-sm text-gray-500">Koliko tx-ova u staging bi pogodilo pravilo.</p>
              </div>

              <div className="flex gap-2">
                <input className="w-40 px-3 py-2 rounded border" placeholder="batch_id (opt)" value={previewBatchId} onChange={(e) => setPreviewBatchId(e.target.value)} />
                <button className="px-3 py-2 rounded bg-black text-white disabled:opacity-50" disabled={!selectedRuleId || previewLoading} onClick={() => runPreview()}>
                  {previewLoading ? "..." : "Run"}
                </button>
              </div>
            </div>

            {previewErr ? <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{previewErr}</div> : null}

            <div className="text-sm">
              <span className="text-gray-500">Matches:</span> <span className="font-medium">{previewCount === null ? "—" : previewCount}</span>
            </div>

            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-2 border-b">tx_id</th>
                    <th className="p-2 border-b">date</th>
                    <th className="p-2 border-b">amount</th>
                    <th className="p-2 border-b">cp</th>
                    <th className="p-2 border-b">description</th>
                  </tr>
                </thead>
                <tbody>
                  {previewSample.length === 0 ? (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={5}>No sample rows.</td>
                    </tr>
                  ) : (
                    previewSample.map((r) => (
                      <tr key={r.tx_id} className="border-t">
                        <td className="p-2">{r.tx_id}</td>
                        <td className="p-2">{r.value_date ?? "—"}</td>
                        <td className="p-2">{String(r.amount)} {r.currency ?? ""}</td>
                        <td className="p-2">{r.counterparty ?? "—"}</td>
                        <td className="p-2">{r.description ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border">
            <div className="p-4 border-b flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{editingRuleId ? `Edit rule #${editingRuleId}` : "New rule"}</div>
                <div className="text-sm text-gray-500">MVP forma.</div>
              </div>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={closeModal}>✕</button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <div className="text-gray-600">priority</div>
                <input className="w-full px-3 py-2 rounded border" value={String(draft.priority ?? 100)} onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))} />
              </label>

              <label className="space-y-1">
                <div className="text-gray-600">is_active</div>
                <select className="w-full px-3 py-2 rounded border" value={String(draft.is_active ?? 1)} onChange={(e) => setDraft((d) => ({ ...d, is_active: Number(e.target.value) as any }))}>
                  <option value="1">active</option>
                  <option value="0">inactive</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-gray-600">match_text</div>
                <input className="w-full px-3 py-2 rounded border" value={draft.match_text ?? ""} onChange={(e) => setDraft((d) => ({ ...d, match_text: asStrOrNull(e.target.value) }))} />
              </label>

              <label className="space-y-1">
                <div className="text-gray-600">match_amount</div>
                <input className="w-full px-3 py-2 rounded border" value={draft.match_amount ?? ""} onChange={(e) => setDraft((d) => ({ ...d, match_amount: asNumOrNull(e.target.value) }))} />
              </label>

              <label className="space-y-1">
                <div className="text-gray-600">match_is_fee</div>
                <select
                  className="w-full px-3 py-2 rounded border"
                  value={draft.match_is_fee === null || draft.match_is_fee === undefined ? "" : String(draft.match_is_fee)}
                  onChange={(e) => setDraft((d) => ({ ...d, match_is_fee: e.target.value === "" ? null : (Number(e.target.value) as any) }))}
                >
                  <option value="">—</option>
                  <option value="1">true</option>
                  <option value="0">false</option>
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-gray-600">projekat_id</div>
                <input className="w-full px-3 py-2 rounded border" value={draft.projekat_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, projekat_id: asNumOrNull(e.target.value) }))} />
              </label>

              <label className="space-y-1">
                <div className="text-gray-600">narucilac_id</div>
                <input className="w-full px-3 py-2 rounded border" value={draft.narucilac_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, narucilac_id: asNumOrNull(e.target.value) }))} />
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-gray-600">kategorija</div>
                <input className="w-full px-3 py-2 rounded border" value={draft.kategorija ?? ""} onChange={(e) => setDraft((d) => ({ ...d, kategorija: asStrOrNull(e.target.value) }))} />
              </label>
            </div>

            <div className="p-4 border-t flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <input className="w-40 px-3 py-2 rounded border" placeholder="batch_id (opt)" value={previewBatchId} onChange={(e) => setPreviewBatchId(e.target.value)} />
                <button className="px-3 py-2 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={previewLoading} onClick={() => runPreview(draft)}>
                  {previewLoading ? "Preview..." : "Preview draft"}
                </button>
              </div>

              <div className="flex gap-2">
                <button className="px-3 py-2 rounded border hover:bg-gray-50" onClick={closeModal}>Cancel</button>
                <button className="px-3 py-2 rounded bg-black text-white disabled:opacity-50" disabled={saving} onClick={saveRule}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {previewCount !== null ? (
              <div className="px-4 pb-4 text-sm">
                <span className="text-gray-500">Draft matches:</span>{" "}
                <span className="font-medium">{previewCount}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
