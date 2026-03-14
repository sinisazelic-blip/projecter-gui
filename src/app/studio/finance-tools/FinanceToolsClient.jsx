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

  return (
    <>
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
