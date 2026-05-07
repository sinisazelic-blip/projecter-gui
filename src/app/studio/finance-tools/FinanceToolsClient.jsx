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
  const [note, setNote] = useState("");
  const [deactLinkId, setDeactLinkId] = useState("");

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
      if (!Number.isFinite(pid) || pid <= 0)
        throw new Error("projekat_id mora biti broj > 0");

      const body = {
        posting_id: Number(posting.posting_id),
        amount_km: Number(posting.amount),
        datum: String(posting.value_date || "").slice(0, 10),
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

  async function openAnalize() {
    setAnalizeOpen(true);
    setDetailRows([]);
    setDetailPartner(null);
    await loadAnalize(analizeType, analizeYear);
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
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">{t("financeTools.analizeTitle")}</div>
        <div className="card-subtitle">{t("financeTools.analizeDesc")}</div>
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={openAnalize}>
          {t("financeTools.openAnalize")}
        </button>
      </div>

      {analizeOpen && (
        <div
          className="card"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 120,
            minWidth: 960,
            maxWidth: "95vw",
            maxHeight: "88vh",
            overflow: "auto",
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
              <div className="card-title" style={{ marginBottom: 6 }}>
                IOS - {detailPartner.partner_naziv} ({fmtDate(new Date().toISOString())})
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
                        <td>{r.projekat_id ? `#${r.projekat_id}` : "—"} {r.projekat_naziv ? ` ${r.projekat_naziv}` : ""}</td>
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
            background: "rgba(0,0,0,0.5)",
            zIndex: 119,
          }}
          aria-hidden="true"
        />
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">{t("financeTools.troskoviBanke")}</div>
        <div className="card-subtitle">{t("financeTools.troskoviBankeDesc")}</div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={openBankCosts}
        >
          {t("financeTools.otvoriPregled")}
        </button>
      </div>

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
                        <br />
                        <span style={{ fontSize: 12 }}>{t("financeTools.noTransactionsHint")}</span>
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
            <div className="label">{t("financeTools.defaultProjekatId")}</div>
            <input
              className="input"
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
              placeholder="1"
            />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="label">{t("financeTools.napomenaOpis")}</div>
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
      </div>

      <div className="card" style={{ marginTop: 12 }}>
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

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">{t("financeTools.unlinkedTitle")}</div>
        <div className="card-subtitle">{t("financeTools.unlinkedHint")}</div>

        <div style={{ marginTop: 10 }}>
          <div className="badge">{t("financeTools.incoming")}: {incoming.length}</div>{" "}
          <div className="badge">{t("financeTools.outgoing")}: {outgoing.length}</div>{" "}
          <div className="badge">{t("financeTools.total")}: {rows.length}</div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("financeTools.colDatum")}</th>
                <th>{t("financeTools.colIznosShort")}</th>
                <th>{t("financeTools.colPartner")}</th>
                <th>{t("financeTools.colOpis")}</th>
                <th style={{ width: 240 }}>{t("financeTools.colAkcija")}</th>
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
                      <td>{r.value_date}</td>
                      <td>
                        {fmt(r.amount)} {r.currency || ""}
                      </td>
                      <td
                        style={{
                          maxWidth: 320,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.counterparty || "—"}
                      </td>
                      <td
                        style={{
                          maxWidth: 420,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.description || "—"}
                      </td>
                      <td>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            className="btn"
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
