"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { formatAmount } from "@/lib/format";

const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
};

const fmtDate = (v) => {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(v);
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
};

const actionBtnStyle = {
  fontSize: 10,
  lineHeight: 1.1,
  padding: "4px 7px",
  minHeight: 24,
};

const actionBtnPayStyle = {
  ...actionBtnStyle,
  background: "rgba(239, 68, 68, 0.2)",
  borderColor: "rgba(239, 68, 68, 0.45)",
};

const actionBtnIncomeStyle = {
  ...actionBtnStyle,
  background: "rgba(34, 197, 94, 0.2)",
  borderColor: "rgba(34, 197, 94, 0.45)",
};

const actionBtnSpecialStyle = {
  ...actionBtnStyle,
  background: "rgba(59, 130, 246, 0.2)",
  borderColor: "rgba(59, 130, 246, 0.45)",
};

export default function FinanceToolsClient() {
  const { t, locale } = useTranslation();
  const MJESECI = useMemo(
    () => [
      t("financeTools.monthJan"), t("financeTools.monthFeb"), t("financeTools.monthMar"),
      t("financeTools.monthApr"), t("financeTools.monthMaj"), t("financeTools.monthJun"),
      t("financeTools.monthJul"), t("financeTools.monthAug"), t("financeTools.monthSep"),
      t("financeTools.monthOct"), t("financeTools.monthNov"), t("financeTools.monthDec"),
    ],
    [t],
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [bankCostsOpen, setBankCostsOpen] = useState(false);
  const [bankCosts, setBankCosts] = useState({ byMonth: [], byYear: {} });
  const [bankCostsLoading, setBankCostsLoading] = useState(false);
  const [analizeOpen, setAnalizeOpen] = useState(false);
  const [analizeType, setAnalizeType] = useState("klijenti");
  const [analizeYear, setAnalizeYear] = useState(new Date().getFullYear());
  const [analizeRows, setAnalizeRows] = useState([]);
  const [analizeSummary, setAnalizeSummary] = useState(null);
  const [analizeLoading, setAnalizeLoading] = useState(false);
  const [analizeErr, setAnalizeErr] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState([]);
  const [detailPartner, setDetailPartner] = useState(null);

  // Quick actions inputs
  const [defaultProjectId, setDefaultProjectId] = useState("1"); // overhead by default
  const [defaultFakturaId, setDefaultFakturaId] = useState("");
  const [note, setNote] = useState("");
  const [deactLinkId, setDeactLinkId] = useState("");
  const [openingCandidates, setOpeningCandidates] = useState(null);

  const incoming = useMemo(
    () => rows.filter((r) => Number(r.amount) > 0),
    [rows],
  );
  const outgoing = useMemo(
    () => rows.filter((r) => Number(r.amount) < 0),
    [rows],
  );

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/finance/postings/unlinked", {
        cache: "no-store",
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to load unlinked");
      setRows(j.rows || []);
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
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
        datum: String(posting.value_date || "").slice(0, 10),
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
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function linkIncome(posting) {
    setErr("");
    try {
      const pid = Number(defaultProjectId);
      const fidRaw = String(defaultFakturaId || "").trim();
      const fid = Number(fidRaw);
      const useInvoice = (Number.isFinite(fid) && fid > 0) || /^\d{1,4}\/\d{4}$/.test(fidRaw);
      if (!useInvoice && (!Number.isFinite(pid) || pid <= 0))
        throw new Error("projekat_id mora biti broj > 0 ili unesi faktura_id");

      const body = {
        posting_id: Number(posting.posting_id),
        amount_km: Number(posting.amount),
        datum: String(posting.value_date || "").slice(0, 10),
        projekat_id: pid,
        faktura_id: useInvoice ? fidRaw : undefined,
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
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function openBankCosts() {
    setBankCostsOpen(true);
    setBankCostsLoading(true);
    try {
      const res = await fetch("/api/finance/bank-costs", { cache: "no-store" });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("financeTools.loadError"));
      setBankCosts({ byMonth: j.byMonth || [], byYear: j.byYear || {} });
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
    } finally {
      setBankCostsLoading(false);
    }
  }

  async function deactivatePaymentLink() {
    setErr("");
    try {
      const link_id = Number(deactLinkId);
      if (!Number.isFinite(link_id) || link_id <= 0)
        throw new Error("link_id mora biti broj > 0");

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
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function linkBankFees() {
    setErr("");
    try {
      const ok = window.confirm("Da automatski povežem sve ne-uparene bankovne provizije?");
      if (!ok) return;
      const res = await fetch("/api/finance/postings/link-bank-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Auto link failed");
      await refresh();
      alert(`Povezano: ${j.linked_count || 0}, preskočeno: ${j.skipped_count || 0}`);
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function linkSpecial(posting, vrsta) {
    setErr("");
    try {
      const body = {
        posting_id: Number(posting.posting_id),
        datum: String(posting.value_date || "").slice(0, 10),
        vrsta,
      };
      const res = await fetch("/api/finance/postings/link-special-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Specijalni link nije uspio");
      await refresh();
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function linkOpeningClient(posting, refId = null) {
    setErr("");
    try {
      const res = await fetch("/api/finance/postings/link-opening-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posting_id: Number(posting.posting_id), ref_id: refId }),
      });
      const j = await res.json();
      if (!j?.ok) {
        const cRes = await fetch(
          `/api/finance/postings/opening-client-candidates?posting_id=${encodeURIComponent(
            Number(posting.posting_id),
          )}`,
          { cache: "no-store" },
        );
        const cj = await cRes.json().catch(() => null);
        if (cj?.ok && Array.isArray(cj?.candidates)) {
          setOpeningCandidates({
            posting_id: Number(posting.posting_id),
            candidates: cj.candidates || [],
          });
          setErr(
            cj.candidates.length > 0
              ? "Odaberi klijenta za početno stanje iz liste ispod."
              : "Nema kandidata u početnom stanju za ovaj posting. Koristi LINK STARI DUG.",
          );
          return;
        }
        throw new Error(j?.error || "Link početno stanje nije uspio");
      }
      setOpeningCandidates(null);
      await refresh();
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function linkLegacyDebt(posting) {
    setErr("");
    try {
      const res = await fetch("/api/finance/postings/link-legacy-debt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting_id: Number(posting.posting_id),
          datum: String(posting.value_date || "").slice(0, 10),
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Link starog duga nije uspio");
      setOpeningCandidates(null);
      await refresh();
    } catch (e) {
      setErr(e?.message ?? t("financeTools.errorLabel"));
    }
  }

  async function loadAnalize(type = analizeType, year = analizeYear) {
    setAnalizeErr("");
    setAnalizeLoading(true);
    try {
      const res = await fetch(
        `/api/finance/analize/summary?type=${encodeURIComponent(type)}&year=${encodeURIComponent(year)}`,
        { cache: "no-store" },
      );
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Load analize failed");
      setAnalizeRows(j.items || []);
      setAnalizeSummary(j.summary || null);
    } catch (e) {
      setAnalizeErr(e?.message || t("financeTools.errorLabel"));
      setAnalizeRows([]);
      setAnalizeSummary(null);
    } finally {
      setAnalizeLoading(false);
    }
  }

  async function openAnalize(type = analizeType) {
    setAnalizeType(type);
    setAnalizeOpen(true);
    setDetailRows([]);
    setDetailPartner(null);
    await loadAnalize(type, analizeYear);
  }

  async function openDetail(row) {
    setDetailPartner(row);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/finance/analize/detail?type=${encodeURIComponent(analizeType)}&year=${encodeURIComponent(analizeYear)}&partner_id=${encodeURIComponent(row.partner_id)}`,
        { cache: "no-store" },
      );
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Load IOS failed");
      setDetailRows(j.events || []);
    } catch (e) {
      setAnalizeErr(e?.message || t("financeTools.errorLabel"));
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openDetailPrintWindow() {
    if (!detailPartner || !detailRows.length) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    const title = `IOS - ${detailPartner.partner_naziv} (${fmtDate(new Date().toISOString())})`;
    const rowsHtml = detailRows
      .map(
        (r) => `
          <tr>
            <td>${escapeHtml(fmtDate(r.event_date))}</td>
            <td style="white-space:pre-line;min-width:220px">${escapeHtml(r.projekat_id ? `#${r.projekat_id}` : "—")} ${escapeHtml(r.projekat_naziv ? ` ${r.projekat_naziv}` : "")}</td>
            <td>${escapeHtml(r.faktura_broj || "—")}</td>
            <td>${escapeHtml(fmtDate(r.datum_fakture))}</td>
            <td>${escapeHtml(r.opis || "—")}</td>
            <td style="text-align:right">${escapeHtml(formatAmount(r.duguje || 0, locale))}</td>
            <td style="text-align:right">${escapeHtml(formatAmount(r.potrazuje || 0, locale))}</td>
            <td style="text-align:right;font-weight:700">${escapeHtml(formatAmount(r.saldo || 0, locale))}</td>
            <td>${escapeHtml(r.nacin_placanja || "—")}</td>
          </tr>`,
      )
      .join("");
    w.document.open();
    w.document.write(`<!doctype html>
      <html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:14px;color:#111}
        .toolbar{margin-bottom:10px;display:flex;gap:8px}
        button{padding:8px 12px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
        th{text-align:left;background:#f4f4f4}
        @media print {.toolbar{display:none} body{padding:0}}
      </style></head>
      <body>
      <div class="toolbar"><button onclick="window.print()">Štampaj</button><button onclick="window.close()">Zatvori</button></div>
      <h2>${escapeHtml(title)}</h2>
      <table><thead><tr>
        <th>${escapeHtml(t("financeTools.colDatum"))}</th>
        <th>${escapeHtml(t("financeTools.colProjekat"))}</th>
        <th>${escapeHtml(t("financeTools.colFakturaBroj"))}</th>
        <th>${escapeHtml(t("financeTools.colDatumFakture"))}</th>
        <th>${escapeHtml(t("financeTools.colOpis"))}</th>
        <th style="text-align:right">${escapeHtml(t("financeTools.colDuguje"))}</th>
        <th style="text-align:right">${escapeHtml(t("financeTools.colPotrazuje"))}</th>
        <th style="text-align:right">${escapeHtml(t("financeTools.colSaldo"))}</th>
        <th>${escapeHtml(t("financeTools.colNacinPlacanja"))}</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    w.document.close();
  }

  async function runYearClose() {
    const ok = window.confirm(
      `${t("financeTools.yearCloseConfirm")} ${analizeYear}?`,
    );
    if (!ok) return;
    setAnalizeErr("");
    try {
      const res = await fetch("/api/finance/analize/year-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: analizeYear }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Year close failed");
      await loadAnalize(analizeType, analizeYear);
      alert(
        `${t("financeTools.yearCloseDone")} ${j.next_year}. ` +
          `${t("financeTools.yearClosePartners")}: ${j.carried.klijenti}/${j.carried.saradnici}/${j.carried.dobavljaci}`,
      );
    } catch (e) {
      setAnalizeErr(e?.message || t("financeTools.errorLabel"));
    }
  }

  return (
    <>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title" title={t("financeTools.analizeDesc")}>{t("financeTools.analizeTitle")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => openAnalize("klijenti")}>
              {t("financeTools.tabKlijenti")}
            </button>
            <button type="button" className="btn" onClick={() => openAnalize("saradnici")}>
              {t("financeTools.tabSaradnici")}
            </button>
            <button type="button" className="btn" onClick={() => openAnalize("dobavljaci")}>
              {t("financeTools.tabDobavljaci")}
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title" title={t("financeTools.troskoviBankeDesc")}>{t("financeTools.troskoviBanke")}</div>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 10 }}
            onClick={openBankCosts}
          >
            {t("financeTools.otvoriPregled")}
          </button>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">{t("financeTools.deaktivacijaLinka")}</div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 200 }}>
              <div className="label">link_id</div>
              <input
                className="input"
                value={deactLinkId}
                onChange={(e) => setDeactLinkId(e.target.value)}
                placeholder={t("financeTools.linkIdPlaceholder")}
              />
            </div>
            <button className="btn btn-danger" onClick={deactivatePaymentLink}>
              {t("financeTools.deaktivirajLink")}
            </button>
          </div>
        </div>
      </div>

      {analizeOpen && (
        <div
          className="card"
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 120,
            width: "auto",
            maxWidth: "none",
            maxHeight: "none",
            overflow: "auto",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--bg) 92%, #0b1220 8%), color-mix(in srgb, var(--bg) 88%, #0f2a2f 12%))",
            border: "1px solid color-mix(in srgb, var(--border, #334155) 75%, transparent 25%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>{t("financeTools.analizeModalTitle")}</div>
            <button type="button" className="btn" onClick={() => setAnalizeOpen(false)}>{t("financeTools.zatvori")}</button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button className={`btn ${analizeType === "klijenti" ? "btn--active" : ""}`} onClick={() => { setAnalizeType("klijenti"); loadAnalize("klijenti", analizeYear); setDetailRows([]); setDetailPartner(null); }}>{t("financeTools.tabKlijenti")}</button>
            <button className={`btn ${analizeType === "saradnici" ? "btn--active" : ""}`} onClick={() => { setAnalizeType("saradnici"); loadAnalize("saradnici", analizeYear); setDetailRows([]); setDetailPartner(null); }}>{t("financeTools.tabSaradnici")}</button>
            <button className={`btn ${analizeType === "dobavljaci" ? "btn--active" : ""}`} onClick={() => { setAnalizeType("dobavljaci"); loadAnalize("dobavljaci", analizeYear); setDetailRows([]); setDetailPartner(null); }}>{t("financeTools.tabDobavljaci")}</button>
            <input
              className="input"
              type="number"
              min="2020"
              max="2100"
              value={analizeYear}
              onChange={(e) => setAnalizeYear(Number(e.target.value) || new Date().getFullYear())}
              style={{ width: 110 }}
            />
            <button className="btn" onClick={() => loadAnalize(analizeType, analizeYear)}>{t("financeTools.osvjezi")}</button>
            <button className="btn btn-danger" onClick={runYearClose}>{t("financeTools.yearCloseButton")}</button>
          </div>

          {analizeErr ? <div className="badge badge-red" style={{ marginBottom: 8 }}>{analizeErr}</div> : null}
          {analizeSummary ? (
            <div style={{ marginBottom: 8, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
              <span className="badge">{t("financeTools.colPocetno")}: {formatAmount(analizeSummary.pocetno_stanje, locale)}</span>
              <span className="badge">{t("financeTools.colRealizovano")}: {formatAmount(analizeSummary.ukupno_realizovano, locale)}</span>
              <span className="badge">{t("financeTools.colPlaceno")}: {formatAmount(analizeSummary.ukupno_placeno, locale)}</span>
              <span className="badge">{t("financeTools.colSaldo")}: {formatAmount(analizeSummary.saldo, locale)}</span>
            </div>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t("financeTools.colPartner")}</th>
                  <th style={{ textAlign: "right" }}>{t("financeTools.colPocetno")}</th>
                  <th style={{ textAlign: "right" }}>{t("financeTools.colRealizovano")}</th>
                  <th style={{ textAlign: "right" }}>{t("financeTools.colPlaceno")}</th>
                  <th style={{ textAlign: "right" }}>{t("financeTools.colSaldo")}</th>
                  <th>{t("financeTools.colAkcija")}</th>
                </tr>
              </thead>
              <tbody>
                {analizeLoading ? (
                  <tr><td colSpan={6}>{t("financeTools.loading")}</td></tr>
                ) : analizeRows.length === 0 ? (
                  <tr><td colSpan={6}>{t("financeTools.noOpenItems")}</td></tr>
                ) : analizeRows.map((r) => (
                  <tr key={`${analizeType}-${r.partner_id}`}>
                    <td>{r.partner_naziv}</td>
                    <td style={{ textAlign: "right" }}>{formatAmount(r.pocetno_stanje, locale)}</td>
                    <td style={{ textAlign: "right" }}>{formatAmount(r.ukupno_realizovano, locale)}</td>
                    <td style={{ textAlign: "right" }}>{formatAmount(r.ukupno_placeno, locale)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatAmount(r.saldo, locale)}</td>
                    <td><button className="btn" onClick={() => openDetail(r)}>{t("financeTools.openIos")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detailPartner && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <div className="card-title" style={{ margin: 0 }}>
                  IOS - {detailPartner.partner_naziv} ({fmtDate(new Date().toISOString())})
                </div>
                <button className="btn" onClick={openDetailPrintWindow} disabled={detailRows.length === 0 || detailLoading}>
                  Otvori za štampu
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("financeTools.colDatum")}</th>
                      <th>{t("financeTools.colProjekat")}</th>
                      <th>{t("financeTools.colFakturaBroj")}</th>
                      <th>{t("financeTools.colDatumFakture")}</th>
                      <th>{t("financeTools.colOpis")}</th>
                      <th style={{ textAlign: "right" }}>{t("financeTools.colDuguje")}</th>
                      <th style={{ textAlign: "right" }}>{t("financeTools.colPotrazuje")}</th>
                      <th style={{ textAlign: "right" }}>{t("financeTools.colSaldo")}</th>
                      <th>{t("financeTools.colNacinPlacanja")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLoading ? (
                      <tr><td colSpan={9}>{t("financeTools.loading")}</td></tr>
                    ) : detailRows.length === 0 ? (
                      <tr><td colSpan={9}>—</td></tr>
                    ) : detailRows.map((r, i) => (
                      <tr key={`${i}-${r.event_date || "x"}`}>
                        <td>{fmtDate(r.event_date)}</td>
                        <td style={{ whiteSpace: "pre-line", minWidth: 240 }}>
                          {r.projekat_id ? `#${r.projekat_id}` : "—"}{r.projekat_naziv ? ` ${r.projekat_naziv}` : ""}
                        </td>
                        <td>{r.faktura_broj || "—"}</td>
                        <td>{fmtDate(r.datum_fakture)}</td>
                        <td>{r.opis || "—"}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.duguje || 0, locale)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.potrazuje || 0, locale)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatAmount(r.saldo || 0, locale)}</td>
                        <td>{r.nacin_placanja || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {analizeOpen && (
        <div
          onClick={() => setAnalizeOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 119,
          }}
          aria-hidden="true"
        />
      )}

      {bankCostsOpen && (
        <div
          className="card"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
            minWidth: 360,
            maxWidth: "90vw",
            maxHeight: "85vh",
            overflow: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ margin: 0 }}>{t("financeTools.troskoviBankeModal")}</div>
            <button type="button" className="btn" onClick={() => setBankCostsOpen(false)}>{t("financeTools.zatvori")}</button>
          </div>
          {bankCostsLoading ? (
            <p style={{ opacity: 0.8 }}>{t("financeTools.loading")}</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("financeTools.colMjesec")}</th>
                    <th>{t("financeTools.colGodina")}</th>
                    <th style={{ textAlign: "right" }}>{t("financeTools.colIznos")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bankCosts.byMonth.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ opacity: 0.8 }}>
                        {t("financeTools.noTransactions")}
                      </td>
                    </tr>
                  ) : (
                    bankCosts.byMonth.map((r, i) => (
                      <tr key={i}>
                        <td>{MJESECI[Number(r.month) - 1] ?? r.month}</td>
                        <td>{r.year}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.total_km)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {Object.keys(bankCosts.byYear).length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  <div className="card-subtitle" style={{ marginBottom: 8 }}>{t("financeTools.ukupnoPoGodini")}</div>
                  {Object.entries(bankCosts.byYear)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .map(([year, total]) => (
                      <div key={year} style={{ display: "flex", justifyContent: "space-between", gap: 24, fontWeight: 700 }}>
                        <span>{year}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatAmount(total, locale)}</span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {bankCostsOpen && (
        <div
          onClick={() => setBankCostsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99,
          }}
          aria-hidden="true"
        />
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <div style={{ minWidth: 180 }}>
            <div className="label" title={t("financeTools.defaultProjekatId")}>Projekt ID</div>
            <input
              className="input"
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
              placeholder="1"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="label" title="Opcionalno: ako uplata pokriva fakturu s više projekata, unesi faktura_id">Faktura ID</div>
            <input
              className="input"
              value={defaultFakturaId}
              onChange={(e) => setDefaultFakturaId(e.target.value)}
              placeholder="npr. 321"
            />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="label" title={t("financeTools.napomenaOpis")}>Napomena</div>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("financeTools.napomenaPlaceholder")}
            />
          </div>

          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? t("financeTools.ucitavam") : t("financeTools.osvjezi")}
          </button>
        </div>

        {err ? (
          <div className="badge badge-red" style={{ marginTop: 10 }}>
            Greška: {err}
          </div>
        ) : null}
        {openingCandidates ? (
          <div className="card" style={{ marginTop: 10, padding: 10 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              Odaberi klijenta za početno stanje (posting #{openingCandidates.posting_id})
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openingCandidates.candidates.map((c) => (
                <button
                  key={`top-${openingCandidates.posting_id}-${c.ref_id}`}
                  className="btn"
                  onClick={() => {
                    const posting = rows.find((x) => Number(x.posting_id) === Number(openingCandidates.posting_id));
                    if (posting) linkOpeningClient(posting, Number(c.ref_id));
                  }}
                >
                  {c.naziv} ({fmt(c.preostalo)} KM)
                </button>
              ))}
              <button className="btn" onClick={() => setOpeningCandidates(null)}>Odustani</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div className="card-title" title={t("financeTools.unlinkedHint")}>{t("financeTools.unlinkedTitle")}</div>
          <button className="btn" title="Automatski poveži provizije banke" onClick={linkBankFees}>
            LINK PROVIZIJE BANKE
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="badge">{t("financeTools.incoming")}: {incoming.length}</div>{" "}
          <div className="badge">{t("financeTools.outgoing")}: {outgoing.length}</div>{" "}
          <div className="badge">{t("financeTools.total")}: {rows.length}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <colgroup>
              <col style={{ width: 56 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: 340 }} />
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("financeTools.colDatum")}</th>
                <th>{t("financeTools.colIznosShort")}</th>
                <th>{t("financeTools.colPartner")}</th>
                <th>{t("financeTools.colOpis")}</th>
                    <th style={{ width: 280 }}>{t("financeTools.colAkcija")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ opacity: 0.8 }}>
                    {t("financeTools.noUnlinked")}
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
                      <td>{fmtDate(r.value_date)}</td>
                      <td>
                        {fmt(r.amount)} {r.currency || ""}
                      </td>
                      <td
                        style={{
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          textAlign: "left",
                          lineHeight: 1.25,
                        }}
                        title={r.counterparty || "—"}
                      >
                        {r.counterparty || "—"}
                      </td>
                      <td
                        style={{
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          textAlign: "left",
                          lineHeight: 1.25,
                        }}
                        title={r.description || "—"}
                      >
                        {r.description || "—"}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 6,
                            alignItems: "stretch",
                          }}
                        >
                          <button
                            className="btn"
                            style={actionBtnPayStyle}
                            disabled={!isOutgoing}
                            title={
                              isOutgoing
                                ? t("financeTools.linkPayTitle")
                                : t("financeTools.linkPayDisabled")
                            }
                            onClick={() => linkPayment(r)}
                          >
                            LINK PAY
                          </button>
                          <button
                            className="btn"
                            style={actionBtnIncomeStyle}
                            disabled={!isIncoming}
                            title={
                              isIncoming
                                ? t("financeTools.linkIncomeTitle")
                                : t("financeTools.linkIncomeDisabled")
                            }
                            onClick={() => linkIncome(r)}
                          >
                            LINK INCOME
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            disabled={!isIncoming}
                            title="Poveži na početno stanje klijenta (stare fakture)"
                            onClick={() => linkOpeningClient(r)}
                          >
                            LINK POCETNO
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            disabled={!isIncoming}
                            title="Naplata starog duga kad klijent nije u početnom stanju"
                            onClick={() => linkLegacyDebt(r)}
                          >
                            LINK STARI DUG
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            disabled={!isOutgoing}
                            title="Poveži kao PDV uplatu"
                            onClick={() => linkSpecial(r, "pdv")}
                          >
                            LINK PDV
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            disabled={!isOutgoing}
                            title="Poveži kao porez"
                            onClick={() => linkSpecial(r, "porez")}
                          >
                            LINK POREZ
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            disabled={!isOutgoing}
                            title="Poveži kao fiskalne kase"
                            onClick={() => linkSpecial(r, "fiskalne")}
                          >
                            LINK FISKALNE
                          </button>
                          <button
                            className="btn"
                            style={actionBtnSpecialStyle}
                            title="Poveži kao kredit (isplata rate ili isplata kredita)"
                            onClick={() => linkSpecial(r, "kredit")}
                          >
                            LINK KREDIT
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
        {openingCandidates && (
          <div className="card" style={{ marginTop: 10, padding: 10 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              Odaberi klijenta za početno stanje (posting #{openingCandidates.posting_id})
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openingCandidates.candidates.map((c) => (
                <button
                  key={`${openingCandidates.posting_id}-${c.ref_id}`}
                  className="btn"
                  onClick={() => {
                    const posting = rows.find((x) => Number(x.posting_id) === Number(openingCandidates.posting_id));
                    if (posting) linkOpeningClient(posting, Number(c.ref_id));
                  }}
                >
                  {c.naziv} ({fmt(c.preostalo)} KM)
                </button>
              ))}
              <button className="btn" onClick={() => setOpeningCandidates(null)}>Odustani</button>
            </div>
            {openingCandidates.candidates.length === 0 ? (
              <div className="card-subtitle" style={{ marginTop: 8 }}>
                Nema kandidata sa preostalim početnim dugom.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
