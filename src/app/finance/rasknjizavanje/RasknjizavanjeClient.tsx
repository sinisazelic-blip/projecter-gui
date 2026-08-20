"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { formatAmount } from "@/lib/format";

type Props = {
  embedded?: boolean;
  batchId?: number | null;
  onClose?: () => void;
};

const fmtDate = (v: string) => {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  if (!y || !m || !d) return v;
  return `${d}.${m}.${y}`;
};

type QueueRow = {
  posting_id: number;
  value_date: string;
  amount: number;
  currency: string;
  counterparty: string | null;
  description: string | null;
  remaining_km: number;
  alloc_status?: string;
  smjer: "IN" | "OUT";
};

type InvoiceRow = {
  faktura_id: number;
  faktura_broj: string;
  datum_izdavanja: string;
  iznos_km: number;
  placeno_km: number;
  preostalo_km: number;
  valuta: string;
  status_derived: string;
};

type ObavezaRow = {
  trosak_id: number;
  opis: string | null;
  projekat_naziv: string | null;
  datum: string;
  iznos_km: number;
  placeno_km: number;
  preostalo_km: number;
};

type AllocRow = {
  key: string;
  faktura_id?: number;
  trosak_id?: number;
  iznos_km: number;
  label: string;
};

const panelStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) minmax(340px, 1.25fr)",
  gap: 16,
  alignItems: "start" as const,
};

const workflowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  marginBottom: 16,
  padding: "10px 14px",
  borderRadius: 10,
  background:
    "linear-gradient(135deg, rgba(59,130,246,.12), rgba(16,185,129,.08))",
  border: "1px solid rgba(59,130,246,.25)",
  fontSize: 13,
};

const queueCellWrap = {
  whiteSpace: "normal" as const,
  wordBreak: "break-word" as const,
  overflowWrap: "anywhere" as const,
  verticalAlign: "top" as const,
  lineHeight: 1.45,
  paddingTop: 10,
  paddingBottom: 10,
};

export default function RasknjizavanjeClient({
  embedded = false,
  batchId = null,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [klijentId, setKlijentId] = useState<number | null>(null);
  const [klijentNaziv, setKlijentNaziv] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [obaveze, setObaveze] = useState<ObavezaRow[]>([]);
  const [partnerTip, setPartnerTip] = useState<"dobavljac" | "talent">("dobavljac");
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerNaziv, setPartnerNaziv] = useState("");
  const [allocs, setAllocs] = useState<AllocRow[]>([]);
  const [tolerancijaKm, setTolerancijaKm] = useState("");
  const [tolerancijaMax, setTolerancijaMax] = useState(0);
  const [tolFakturaId, setTolFakturaId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientHits, setClientHits] = useState<{ klijent_id: number; naziv: string }[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerHits, setPartnerHits] = useState<{ partner_id: number; naziv: string }[]>([]);
  const [filterBatchOnly, setFilterBatchOnly] = useState(!!batchId);
  const [suggestedAction, setSuggestedAction] = useState<
    | "owner_transfer"
    | "owner_loan"
    | "fx_conversion"
    | "bank_provizija"
    | "invoice"
    | "expense"
    | null
  >(null);
  const [bankFeeLabel, setBankFeeLabel] = useState<string | null>(null);
  const [fxPairPostingId, setFxPairPostingId] = useState<number | null>(null);

  const refreshQueue = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterBatchOnly && batchId) qs.set("batch_id", String(batchId));
      const res = await fetch(`/api/finance/rasknjizavanje/queue?${qs}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("rasknjizavanje.loadError"));
      setQueue(j.rows || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("financeTools.errorLabel"));
    } finally {
      setLoading(false);
    }
  }, [batchId, filterBatchOnly, t]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const allocatedSum = useMemo(
    () => Math.round(allocs.reduce((s, a) => s + Number(a.iznos_km || 0), 0) * 100) / 100,
    [allocs],
  );

  const remaining = useMemo(() => {
    if (!selected) return 0;
    const base = round2(Math.max(0, Number(selected.remaining_km ?? 0)));
    return round2(base - allocatedSum);
  }, [selected, allocatedSum]);

  function round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  async function loadInvoices(kid: number) {
    const res = await fetch(`/api/finance/rasknjizavanje/open?klijent_id=${kid}`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || t("rasknjizavanje.invoicesError"));
    setInvoices(j.invoices || []);
    setTolerancijaMax(Number(j.tolerancija_max_km || 0));
  }

  async function loadObaveze(pid: number, tip: "dobavljac" | "talent") {
    const res = await fetch(
      `/api/finance/rasknjizavanje/open?mode=obaveze&partner_tip=${tip}&partner_id=${pid}`,
    );
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.error || t("rasknjizavanje.obavezeError"));
    setObaveze(j.obaveze || []);
  }

  async function pickPosting(row: QueueRow) {
    setSelected(row);
    setAllocs([]);
    setTolerancijaKm("");
    setTolFakturaId(null);
    setErr("");
    setInvoices([]);
    setObaveze([]);
    setSuggestedAction(null);
    setFxPairPostingId(null);
    setBankFeeLabel(null);
    try {
      const res = await fetch(
        `/api/finance/rasknjizavanje/suggest?posting_id=${encodeURIComponent(row.posting_id)}`,
        { cache: "no-store" },
      );
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Suggest failed");

      const action = j.suggested_action as
        | "owner_transfer"
        | "owner_loan"
        | "fx_conversion"
        | "bank_provizija"
        | "invoice"
        | "expense"
        | null;

      let resolved = action ?? null;
      if (!resolved && row.smjer === "IN") {
        const desc = String(row.description || "").toLowerCase();
        if (desc.includes("posudba vlasnika") || desc.includes("posudba vlasniku")) {
          resolved = "owner_loan";
        }
      }

      setSuggestedAction(resolved);
      if (j.fx_pair_posting_id) setFxPairPostingId(Number(j.fx_pair_posting_id));
      setBankFeeLabel(j.bank_fee_label ? String(j.bank_fee_label) : null);

      if (
        resolved === "owner_transfer" ||
        resolved === "owner_loan" ||
        resolved === "fx_conversion" ||
        resolved === "bank_provizija"
      ) {
        return;
      }

      if (row.smjer === "IN") {
        const kid = j.suggested_klijent_id ? Number(j.suggested_klijent_id) : null;
        if (kid) {
          setKlijentId(kid);
          setKlijentNaziv(String(j.suggested_klijent_naziv || ""));
          await loadInvoices(kid);
          if (j.suggested_faktura_id) {
            const inv = (await (
              await fetch(`/api/finance/rasknjizavanje/open?klijent_id=${kid}`)
            ).json()).invoices?.find(
              (x: InvoiceRow) => x.faktura_id === Number(j.suggested_faktura_id),
            );
            if (inv) {
              const amt = Math.min(row.remaining_km, inv.preostalo_km);
              setAllocs([
                {
                  key: `f-${inv.faktura_id}`,
                  faktura_id: inv.faktura_id,
                  iznos_km: amt,
                  label: inv.faktura_broj,
                },
              ]);
            }
          }
        }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("financeTools.errorLabel"));
    }
  }

  async function searchClients() {
    if (clientSearch.trim().length < 2) return;
    const res = await fetch(
      `/api/finance/rasknjizavanje/open?mode=clients&q=${encodeURIComponent(clientSearch)}`,
    );
    const j = await res.json();
    setClientHits(j.clients || []);
  }

  async function searchPartners() {
    if (partnerSearch.trim().length < 2) return;
    const res = await fetch(
      `/api/finance/rasknjizavanje/open?mode=partners&partner_tip=${partnerTip}&q=${encodeURIComponent(partnerSearch)}`,
    );
    const j = await res.json();
    setPartnerHits(j.partners || []);
  }

  function addInvoiceAlloc(inv: InvoiceRow) {
    if (!selected) return;
    if (selected.remaining_km <= 0.01) {
      setTolFakturaId(inv.faktura_id);
      setTolerancijaKm(String(inv.preostalo_km));
      setAllocs([]);
      return;
    }
    const amt = Math.min(remaining > 0 ? remaining : selected.remaining_km, inv.preostalo_km);
    if (!(amt > 0)) return;
    setAllocs((prev) => {
      if (prev.some((a) => a.faktura_id === inv.faktura_id)) return prev;
      return [
        ...prev,
        {
          key: `f-${inv.faktura_id}`,
          faktura_id: inv.faktura_id,
          iznos_km: amt,
          label: inv.faktura_broj,
        },
      ];
    });
  }

  function addObavezaAlloc(ob: ObavezaRow) {
    if (!selected) return;
    const amt = Math.min(remaining > 0 ? remaining : selected.remaining_km, ob.preostalo_km);
    if (!(amt > 0)) return;
    setAllocs((prev) => {
      if (prev.some((a) => a.trosak_id === ob.trosak_id)) return prev;
      return [
        ...prev,
        {
          key: `t-${ob.trosak_id}`,
          trosak_id: ob.trosak_id,
          iznos_km: amt,
          label: ob.opis || `Trošak #${ob.trosak_id}`,
        },
      ];
    });
  }

  async function commit() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    try {
      const isIn = selected.smjer === "IN";

      let tolerancija = null;
      const tol = Number(String(tolerancijaKm).replace(",", "."));
      const tolFaktura = allocs[0]?.faktura_id ?? tolFakturaId;
      if (isIn && tol > 0 && tolFaktura) {
        tolerancija = {
          faktura_id: tolFaktura,
          iznos_km: tol,
          napomena: t("rasknjizavanje.tolerancijaNote"),
        };
      }

      const lines =
        remaining <= 0.01 && tolerancija
          ? []
          : allocs.map((a) => ({
              vrsta: isIn ? "NAPLATA_FAKTURE" : "ISPLATA_TROSKA",
              iznos_km: Number(a.iznos_km),
              faktura_id: a.faktura_id,
              trosak_id: a.trosak_id,
              klijent_id: isIn ? klijentId : undefined,
              dobavljac_id: !isIn && partnerTip === "dobavljac" ? partnerId : undefined,
              talent_id: !isIn && partnerTip === "talent" ? partnerId : undefined,
            }));

      const res = await fetch("/api/finance/rasknjizavanje/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting_id: selected.posting_id,
          lines,
          tolerancija,
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("rasknjizavanje.commitError"));

      setSelected(null);
      setAllocs([]);
      setTolerancijaKm("");
      setTolFakturaId(null);
      await refreshQueue();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("financeTools.errorLabel"));
    } finally {
      setBusy(false);
    }
  }

  const primaryInvoice =
    allocs.length === 1 && allocs[0].faktura_id
      ? invoices.find((i) => i.faktura_id === allocs[0].faktura_id)
      : tolFakturaId
        ? invoices.find((i) => i.faktura_id === tolFakturaId) ?? null
        : null;
  const gapAfterAlloc = primaryInvoice
    ? allocs.length === 1
      ? Math.max(0, round2(primaryInvoice.preostalo_km - allocs[0].iznos_km))
      : remaining <= 0.01
        ? primaryInvoice.preostalo_km
        : 0
    : 0;

  const tolReady =
    Number(String(tolerancijaKm).replace(",", ".")) > 0 &&
    (allocs[0]?.faktura_id ?? tolFakturaId) != null;
  const canCommit =
    !busy &&
    (allocs.length > 0 || tolReady) &&
    remaining >= -0.01 &&
    !(allocs.length > 0 && remaining < -0.01);

  const incomingCount = queue.filter((q) => q.smjer === "IN").length;
  const outgoingCount = queue.filter((q) => q.smjer === "OUT").length;

  const normCurrency = (v: string) => {
    const u = String(v || "BAM").trim().toUpperCase();
    if (u === "BAM" || u === "KM") return "KM";
    return u;
  };

  const filteredInvoices = useMemo(() => {
    if (!selected || selected.smjer !== "IN") return invoices;
    const pc = normCurrency(selected.currency);
    const matched = invoices.filter((inv) => normCurrency(inv.valuta) === pc);
    return matched.length > 0 ? matched : invoices;
  }, [invoices, selected]);

  const showTolerancijaPanel =
    !!klijentId &&
    selected?.smjer === "IN" &&
    (gapAfterAlloc > 0.01 ||
      (remaining <= 0.01 &&
        allocs.length === 0 &&
        filteredInvoices.some((i) => i.preostalo_km > 0.01)));

  async function commitSpecial(
    vrsta:
      | "PRENOS_VLASNIKA"
      | "POSUDBA_VLASNIKA"
      | "KONVERZIJA"
      | "BANK_PROVIZIJA"
      | "PDV"
      | "POREZ"
      | "KREDIT"
      | "FISKALNE"
      | "KAMATA"
      | "VEC_KNJIZENO"
      | "DIREKTAN_TROSAK"
      | "OSTALO",
    iznos_km?: number,
    napomena?: string,
    extra?: {
      faktura_id?: number | null;
      klijent_id?: number | null;
      dobavljac_id?: number | null;
      talent_id?: number | null;
    },
  ) {
    if (!selected) return;
    setBusy(true);
    setErr("");
    try {
      const amt = iznos_km ?? Math.abs(selected.amount);
      const res = await fetch("/api/finance/rasknjizavanje/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting_id: selected.posting_id,
          lines: [
            {
              vrsta,
              iznos_km: amt,
              napomena: napomena || undefined,
              faktura_id: extra?.faktura_id ?? undefined,
              klijent_id: extra?.klijent_id ?? undefined,
              dobavljac_id: extra?.dobavljac_id ?? undefined,
              talent_id: extra?.talent_id ?? undefined,
            },
          ],
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("rasknjizavanje.commitError"));
      setSelected(null);
      setAllocs([]);
      setSuggestedAction(null);
      setFxPairPostingId(null);
      setBankFeeLabel(null);
      await refreshQueue();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : t("financeTools.errorLabel"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!embedded ? null : (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>
            {t("rasknjizavanje.title")}
          </div>
          {onClose ? (
            <button type="button" className="btn" onClick={onClose}>
              {t("financeTools.zatvori")}
            </button>
          ) : null}
        </div>
      )}

      <div style={workflowStyle}>
        <span>
          <strong>1.</strong> {t("rasknjizavanje.stepImport")}
        </span>
        <span>→</span>
        <span>
          <strong>2.</strong> {t("rasknjizavanje.stepCommit")}
        </span>
        <span>→</span>
        <span>
          <strong>3.</strong> {t("rasknjizavanje.stepRasknjizavanje")}
        </span>
        {!embedded ? (
          <>
            <span style={{ flex: 1 }} />
            <Link href="/banking/import" className="btn" style={{ fontSize: 12 }}>
              {t("rasknjizavanje.goImport")}
            </Link>
          </>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button type="button" className="btn" onClick={refreshQueue} disabled={loading}>
          {loading ? t("financeTools.ucitavam") : t("financeTools.osvjezi")}
        </button>
        {batchId ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={filterBatchOnly}
              onChange={(e) => setFilterBatchOnly(e.target.checked)}
            />
            {t("rasknjizavanje.onlyThisBatch")} #{batchId}
          </label>
        ) : null}
        <span className="badge badge-orange">{t("rasknjizavanje.queueCount")}: {queue.length}</span>
        <span className="badge badge-green">IN: {incomingCount}</span>
        <span className="badge badge-red">OUT: {outgoingCount}</span>
      </div>

      {err ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(239,68,68,.5)",
            marginBottom: 12,
            color: "var(--bad, #f87171)",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={panelStyle}>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">{t("rasknjizavanje.queueTitle")}</div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 12 }}>
            {t("rasknjizavanje.queueHint")}
          </p>
          <div className="tableCard table-wrap" style={{ maxHeight: "68vh", overflow: "auto" }}>
            <table className="table rasknjizavanje-queue-table" style={{ width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "76px" }} />
                <col style={{ width: "104px" }} />
                <col style={{ width: "36%" }} />
                <col style={{ width: "auto" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t("financeTools.colDatum")}</th>
                  <th style={{ textAlign: "right" }}>{t("financeTools.colIznosShort")}</th>
                  <th>{t("financeTools.colPartner")}</th>
                  <th>{t("financeTools.colOpis")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr
                    key={r.posting_id}
                    onClick={() => pickPosting(r)}
                    style={{
                      cursor: "pointer",
                      background:
                        selected?.posting_id === r.posting_id
                          ? "rgba(59,130,246,.15)"
                          : undefined,
                    }}
                  >
                    <td className="nowrap" style={queueCellWrap}>
                      {fmtDate(r.value_date)}
                    </td>
                    <td
                      className="num"
                      style={{
                        ...queueCellWrap,
                        fontWeight: 700,
                        color: r.amount > 0 ? "var(--good)" : "var(--bad)",
                      }}
                    >
                      {formatAmount(r.amount)} {r.currency}
                    </td>
                    <td style={queueCellWrap}>{r.counterparty || "—"}</td>
                    <td style={queueCellWrap}>{r.description || "—"}</td>
                  </tr>
                ))}
                {!loading && queue.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, opacity: 0.75 }}>
                      {t("rasknjizavanje.queueEmpty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          {!selected ? (
            <p className="subtle" style={{ margin: 0 }}>
              {t("rasknjizavanje.selectPosting")}
            </p>
          ) : (
            <>
              <div className="card-title">
                {t("rasknjizavanje.knjizenje")} #{selected.posting_id}
              </div>
              <p style={{ marginTop: 0, fontSize: 14 }}>
                <strong>{selected.counterparty || "—"}</strong>
                <br />
                <span style={{ opacity: 0.85 }}>
                  {formatAmount(selected.amount)} {selected.currency} ·{" "}
                  {t("rasknjizavanje.remaining")}:{" "}
                  <strong>{formatAmount(remaining)}</strong>
                  {selected.alloc_status === "OVER_ALLOCATED" ? (
                    <span style={{ color: "var(--warn, #eab308)", marginLeft: 8 }}>
                      ({t("rasknjizavanje.postingFullyAllocated")})
                    </span>
                  ) : null}
                </span>
              </p>

              {suggestedAction === "owner_transfer" ? (
                <div
                  className="card"
                  style={{
                    marginBottom: 16,
                    background: "rgba(16,185,129,.1)",
                    borderColor: "rgba(16,185,129,.35)",
                  }}
                >
                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.ownerTransferTitle")}
                  </div>
                  <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>
                    {t("rasknjizavanje.ownerTransferHint")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => commitSpecial("PRENOS_VLASNIKA")}
                  >
                    {busy
                      ? t("rasknjizavanje.committing")
                      : t("rasknjizavanje.ownerTransferBtn")}
                  </button>
                </div>
              ) : null}

              {suggestedAction === "owner_loan" ? (
                <div
                  className="card"
                  style={{
                    marginBottom: 16,
                    background: "rgba(234,179,8,.1)",
                    borderColor: "rgba(234,179,8,.35)",
                  }}
                >
                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.ownerLoanTitle")}
                  </div>
                  <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>
                    {t("rasknjizavanje.ownerLoanHint")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => commitSpecial("POSUDBA_VLASNIKA")}
                  >
                    {busy ? t("rasknjizavanje.committing") : t("rasknjizavanje.ownerLoanBtn")}
                  </button>
                </div>
              ) : null}

              {suggestedAction === "bank_provizija" ? (
                <div
                  className="card"
                  style={{
                    marginBottom: 16,
                    background: "rgba(239,68,68,.08)",
                    borderColor: "rgba(239,68,68,.35)",
                  }}
                >
                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.bankFeeTitle")}
                    {bankFeeLabel ? ` — ${bankFeeLabel}` : ""}
                  </div>
                  <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>
                    {t("rasknjizavanje.bankFeeHint")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      commitSpecial(
                        "BANK_PROVIZIJA",
                        undefined,
                        bankFeeLabel || t("rasknjizavanje.bankFeeDefaultNote"),
                      )
                    }
                  >
                    {busy ? t("rasknjizavanje.committing") : t("rasknjizavanje.bankFeeBtn")}
                  </button>
                </div>
              ) : null}

              {suggestedAction === "fx_conversion" ? (
                <div
                  className="card"
                  style={{
                    marginBottom: 16,
                    background: "rgba(59,130,246,.1)",
                    borderColor: "rgba(59,130,246,.35)",
                  }}
                >
                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.fxConversionTitle")}
                  </div>
                  <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>
                    {t("rasknjizavanje.fxConversionHint")}
                    {fxPairPostingId ? (
                      <>
                        {" "}
                        {t("rasknjizavanje.fxPairHint")} #{fxPairPostingId}.
                      </>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => commitSpecial("KONVERZIJA")}
                  >
                    {busy
                      ? t("rasknjizavanje.committing")
                      : t("rasknjizavanje.fxConversionBtn")}
                  </button>
                </div>
              ) : null}

              {selected.smjer === "IN" &&
              suggestedAction !== "fx_conversion" &&
              suggestedAction !== "owner_loan" &&
              suggestedAction !== "bank_provizija" ? (
                <>
                  <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => commitSpecial("POSUDBA_VLASNIKA")}
                      title={t("rasknjizavanje.ownerLoanHint")}
                    >
                      {t("rasknjizavanje.ownerLoanBtn")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        commitSpecial("KAMATA", undefined, t("rasknjizavanje.interestDefaultNote"))
                      }
                      title={t("rasknjizavanje.interestHint")}
                    >
                      {t("rasknjizavanje.interestBtn")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        commitSpecial(
                          "VEC_KNJIZENO",
                          undefined,
                          t("rasknjizavanje.alreadyBookedDefaultNote"),
                          {
                            faktura_id: allocs[0]?.faktura_id ?? tolFakturaId,
                            klijent_id: klijentId,
                          },
                        )
                      }
                      title={t("rasknjizavanje.alreadyBookedHint")}
                    >
                      {t("rasknjizavanje.alreadyBookedBtn")}
                    </button>
                  </div>
                  <div className="label">{t("rasknjizavanje.client")}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <input
                      value={klijentNaziv || clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setKlijentNaziv(e.target.value);
                      }}
                      placeholder={t("rasknjizavanje.searchClient")}
                      className="input"
                      style={{ flex: 1, minWidth: 180 }}
                    />
                    <button type="button" className="btn" onClick={searchClients}>
                      {t("rasknjizavanje.search")}
                    </button>
                  </div>
                  {clientHits.length > 0 ? (
                    <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {clientHits.map((c) => (
                        <button
                          key={c.klijent_id}
                          type="button"
                          className="btn"
                          onClick={() => {
                            setKlijentId(c.klijent_id);
                            setKlijentNaziv(c.naziv);
                            loadInvoices(c.klijent_id).catch((e) =>
                              setErr(e instanceof Error ? e.message : t("financeTools.errorLabel")),
                            );
                          }}
                        >
                          {c.naziv}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.openInvoices")}
                  </div>
                  <div className="tableCard table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("financeTools.colFakturaBroj")}</th>
                          <th style={{ textAlign: "right" }}>{t("financeTools.colIznosShort")}</th>
                          <th style={{ textAlign: "right" }}>{t("rasknjizavanje.paid")}</th>
                          <th style={{ textAlign: "right" }}>{t("rasknjizavanje.left")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((inv) => (
                          <tr key={inv.faktura_id}>
                            <td>
                              {inv.faktura_broj}
                              <div style={{ fontSize: 10, opacity: 0.7 }}>{inv.status_derived}</div>
                            </td>
                            <td className="num">{formatAmount(inv.iznos_km)}</td>
                            <td className="num">{formatAmount(inv.placeno_km)}</td>
                            <td className="num">{formatAmount(inv.preostalo_km)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn"
                                style={actionBtnIncomeStyle}
                                onClick={() => addInvoiceAlloc(inv)}
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!klijentId ? (
                          <tr>
                            <td colSpan={5} className="subtle">
                              {t("rasknjizavanje.pickClientFirst")}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {showTolerancijaPanel ? (
                    <div
                      className="card"
                      style={{
                        marginTop: 12,
                        background: "rgba(234,179,8,.08)",
                        borderColor: "rgba(234,179,8,.35)",
                      }}
                    >
                      <div className="card-title" style={{ fontSize: 13 }}>
                        {t("rasknjizavanje.tolerancijaTitle")}
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                        {gapAfterAlloc > 0.01 ? (
                          <>
                            {t("rasknjizavanje.tolerancijaHint")}{" "}
                            <strong>{formatAmount(gapAfterAlloc)}</strong>.{" "}
                          </>
                        ) : (
                          <span>{t("rasknjizavanje.tolerancijaPickInvoice")}. </span>
                        )}
                        {t("rasknjizavanje.tolerancijaMax")}{" "}
                        <strong>{formatAmount(tolerancijaMax)}</strong>.
                        {remaining <= 0.01 ? (
                          <span> {t("rasknjizavanje.tolerancijaNoPostingBudget")}</span>
                        ) : null}
                      </p>
                      {remaining <= 0.01 && allocs.length === 0 ? (
                        <select
                          className="input"
                          value={tolFakturaId ?? ""}
                          onChange={(e) =>
                            setTolFakturaId(e.target.value ? Number(e.target.value) : null)
                          }
                          style={{ maxWidth: 280, marginBottom: 8 }}
                        >
                          <option value="">{t("rasknjizavanje.tolerancijaPickInvoice")}</option>
                          {filteredInvoices
                            .filter((i) => i.preostalo_km > 0.01)
                            .map((i) => (
                              <option key={i.faktura_id} value={i.faktura_id}>
                                {i.faktura_broj} ({formatAmount(i.preostalo_km)})
                              </option>
                            ))}
                        </select>
                      ) : null}
                      <input
                        className="input"
                        placeholder={t("rasknjizavanje.tolerancijaAmount")}
                        value={tolerancijaKm}
                        onChange={(e) => setTolerancijaKm(e.target.value)}
                        style={{ maxWidth: 160 }}
                      />
                    </div>
                  ) : null}
                </>
              ) : suggestedAction !== "owner_transfer" &&
                suggestedAction !== "owner_loan" &&
                suggestedAction !== "fx_conversion" &&
                suggestedAction !== "bank_provizija" ? (
                <>
                  {selected.smjer === "OUT" ? (
                    <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => commitSpecial("PRENOS_VLASNIKA")}
                        title={t("rasknjizavanje.ownerTransferHint")}
                      >
                        {t("rasknjizavanje.ownerTransferBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial("BANK_PROVIZIJA", undefined, t("rasknjizavanje.bankFeeDefaultNote"))
                        }
                        title={t("rasknjizavanje.bankFeeHint")}
                      >
                        {t("rasknjizavanje.bankFeeBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial("FISKALNE", undefined, t("rasknjizavanje.fiscalDefaultNote"))
                        }
                        title={t("rasknjizavanje.fiscalHint")}
                      >
                        {t("rasknjizavanje.fiscalBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial("PDV", undefined, t("rasknjizavanje.pdvDefaultNote"))
                        }
                        title={t("rasknjizavanje.pdvHint")}
                      >
                        {t("rasknjizavanje.pdvBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial("POREZ", undefined, t("rasknjizavanje.taxDefaultNote"))
                        }
                        title={t("rasknjizavanje.taxHint")}
                      >
                        {t("rasknjizavanje.taxBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial("KREDIT", undefined, t("rasknjizavanje.creditDefaultNote"))
                        }
                        title={t("rasknjizavanje.creditHint")}
                      >
                        {t("rasknjizavanje.creditBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy || !partnerId}
                        onClick={() =>
                          commitSpecial(
                            "DIREKTAN_TROSAK",
                            undefined,
                            t("rasknjizavanje.directExpenseDefaultNote"),
                            {
                              dobavljac_id: partnerTip === "dobavljac" ? partnerId : null,
                              talent_id: partnerTip === "talent" ? partnerId : null,
                            },
                          )
                        }
                        title={t("rasknjizavanje.directExpenseHint")}
                      >
                        {t("rasknjizavanje.directExpenseBtn")}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          commitSpecial(
                            "VEC_KNJIZENO",
                            undefined,
                            t("rasknjizavanje.alreadyBookedDefaultNote"),
                          )
                        }
                        title={t("rasknjizavanje.alreadyBookedHint")}
                      >
                        {t("rasknjizavanje.alreadyBookedBtn")}
                      </button>
                    </div>
                  ) : null}
                  <div className="label">{t("rasknjizavanje.payablePartner")}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 12,
                      alignItems: "center",
                    }}
                  >
                    <select
                      className="input"
                      value={partnerTip}
                      onChange={(e) =>
                        setPartnerTip(e.target.value as "dobavljac" | "talent")
                      }
                    >
                      <option value="dobavljac">{t("financeTools.tabDobavljaci")}</option>
                      <option value="talent">{t("financeTools.tabSaradnici")}</option>
                    </select>
                    <input
                      className="input"
                      value={partnerNaziv || partnerSearch}
                      onChange={(e) => {
                        setPartnerSearch(e.target.value);
                        setPartnerNaziv(e.target.value);
                      }}
                      placeholder={t("rasknjizavanje.searchPartner")}
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    <button type="button" className="btn" onClick={searchPartners}>
                      {t("rasknjizavanje.search")}
                    </button>
                  </div>
                  {partnerHits.length > 0 ? (
                    <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {partnerHits.map((p) => (
                        <button
                          key={p.partner_id}
                          type="button"
                          className="btn"
                          onClick={() => {
                            setPartnerId(p.partner_id);
                            setPartnerNaziv(p.naziv);
                            loadObaveze(p.partner_id, partnerTip).catch((e) =>
                              setErr(e instanceof Error ? e.message : t("financeTools.errorLabel")),
                            );
                          }}
                        >
                          {p.naziv}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="card-title" style={{ fontSize: 14 }}>
                    {t("rasknjizavanje.openObaveze")}
                  </div>
                  <div className="tableCard table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("financeTools.colOpis")}</th>
                          <th>{t("financeTools.colProjekat")}</th>
                          <th style={{ textAlign: "right" }}>{t("rasknjizavanje.left")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {obaveze.map((ob) => (
                          <tr key={ob.trosak_id}>
                            <td>{ob.opis || `#${ob.trosak_id}`}</td>
                            <td>{ob.projekat_naziv || "—"}</td>
                            <td className="num">{formatAmount(ob.preostalo_km)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn"
                                style={actionBtnPayStyle}
                                onClick={() => addObavezaAlloc(ob)}
                              >
                                +
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {allocs.length > 0 ? (
                <>
                  <div className="card-title" style={{ fontSize: 14, marginTop: 16 }}>
                    {t("rasknjizavanje.allocation")}
                  </div>
                  <div className="tableCard table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("financeTools.colOpis")}</th>
                          <th style={{ textAlign: "right" }}>{t("financeTools.colIznosShort")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocs.map((a) => (
                          <tr key={a.key}>
                            <td>{a.label}</td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                value={a.iznos_km}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setAllocs((prev) =>
                                    prev.map((x) =>
                                      x.key === a.key ? { ...x, iznos_km: v } : x,
                                    ),
                                  );
                                }}
                                style={{ maxWidth: 120, textAlign: "right" }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canCommit}
                  onClick={commit}
                >
                  {busy ? t("rasknjizavanje.committing") : t("rasknjizavanje.confirm")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelected(null);
                    setAllocs([]);
                    setTolFakturaId(null);
                    setTolerancijaKm("");
                  }}
                >
                  {t("rasknjizavanje.cancel")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const actionBtnIncomeStyle = {
  fontSize: 11,
  padding: "4px 10px",
  background: "rgba(34, 197, 94, 0.2)",
  borderColor: "rgba(34, 197, 94, 0.45)",
};

const actionBtnPayStyle = {
  fontSize: 11,
  padding: "4px 10px",
  background: "rgba(239, 68, 68, 0.2)",
  borderColor: "rgba(239, 68, 68, 0.45)",
};
