// src/app/izvodi/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

function fmtDDMMYYYY(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number | null, ccy: string): string {
  if (n === null || n === undefined) return "—";
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)} ${ccy}`;
}

type Izvod = {
  batch_id: number;
  account_id: number | null;
  source: string | null;
  upp_id: string | null;
  bank_account_no: string | null;
  tax_id: string | null;
  company_name: string | null;
  statement_no: string | null;
  statement_date: string | null;
  currency: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  total_debit: number | null;
  total_credit: number | null;
  file_hash: string | null;
  imported_at: string | null;
};

type Transakcija = {
  tx_id: number;
  batch_id: number;
  tx_hash: string | null;
  reference: string | null;
  value_date: string | null;
  amount: number | null;
  currency: string | null;
  counterparty: string | null;
  counterparty_bank: string | null;
  description: string | null;
  full_description: string | null;
  tx_type: string | null;
  direction_flag: string | null;
  is_fee: number | null;
  fee_for_reference: string | null;
  status: string | null;
  created_at: string | null;
  raw_json: any;
};

export default function IzvodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const izvodId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [izvod, setIzvod] = useState<Izvod | null>(null);
  const [transakcije, setTransakcije] = useState<Transakcija[]>([]);

  useEffect(() => {
    if (!Number.isFinite(izvodId) || izvodId <= 0) {
      setError(t("izvodi.invalidId"));
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/bank/batch?id=${izvodId}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || t("izvodi.loadErrorDetail"));
        }

        setIzvod(data.batch);
        setTransakcije(data.txs || []);
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [izvodId]);

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (error || !izvod) {
    return (
      <div className="container">
        <div
          style={{
            padding: 20,
            background: "rgba(255, 59, 48, 0.1)",
            borderRadius: 8,
            color: "#ff3b30",
          }}
        >
          ⚠️ {error || t("izvodi.notFound")}
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/izvodi" className="btn">
            ← {t("izvodi.backToList")}
          </Link>
        </div>
      </div>
    );
  }

  const valuta = izvod.currency || "BAM";
  const isEUR = valuta === "EUR" || valuta === "978";
  const isBAM = valuta === "BAM" || valuta === "977" || !isEUR;

  // Kurs za konverziju EUR -> BAM (fiksni dok ne uvedemo dinamički)
  const EUR_TO_BAM = 1.95583;

  // Izračunaj promet
  const ukupnoDuguje = izvod.total_debit || 0;
  const ukupnoPotrazuje = izvod.total_credit || 0;
  const saldoPrometa = ukupnoPotrazuje - ukupnoDuguje;

  // Za EUR izvode, izračunaj BAM ekvivalente
  const ukupnoDugujeBAM = isEUR ? ukupnoDuguje * EUR_TO_BAM : ukupnoDuguje;
  const ukupnoPotrazujeBAM = isEUR ? ukupnoPotrazuje * EUR_TO_BAM : ukupnoPotrazuje;
  const saldoPrometaBAM = ukupnoPotrazujeBAM - ukupnoDugujeBAM;
  const stariSaldoBAM = isEUR && izvod.opening_balance !== null 
    ? izvod.opening_balance * EUR_TO_BAM 
    : izvod.opening_balance;
  const noviSaldoBAM = isEUR && izvod.closing_balance !== null 
    ? izvod.closing_balance * EUR_TO_BAM 
    : izvod.closing_balance;

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        .topBlock {
          position: sticky; top:0; z-index: 40;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .topRow { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 18px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .btn {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          white-space: nowrap;
        }
        .btn:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .btn:active { transform: scale(.985); }

        .divider { height:1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }

        .body { flex:1; min-height:0; overflow:auto; padding: 18px 0 28px; min-width: 0; }

        .paperStage{ display:flex; justify-content:center; padding: 0 10px; min-width: 0; max-width: 100%; }
        .paper{
          width: 210mm;
          max-width: 100%;
          min-height: 297mm;
          background: #ffffff;
          color: #000;
          border-radius: 12px;
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
          border: 1px solid rgba(0,0,0,.08);
          padding: 18mm 16mm;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .paper .table,
        .paper .table thead th,
        .paper .table tbody td,
        .paper .table td,
        .paper .table th,
        .paper .table .num,
        .paper .table .desc,
        .paper .table .ref {
          color: #000 !important;
        }
        .paper .table { font-size: 9px !important; }
        .paper .table thead th,
        .paper .table th { font-size: 8px !important; }
        .paper .table tbody td,
        .paper .table td { font-size: 9px !important; }
        .paper .table .num,
        .paper .table .desc,
        .paper .table .ref { font-size: 9px !important; }
        @media (max-width: 980px){
          .paper{ width: min(100%, 210mm); padding: 16px; }
        }

        .izvodHeader{
          margin-bottom: 14px;
          border-bottom: 2px solid rgba(0,0,0,.15);
          padding-bottom: 12px;
        }

        .izvodTitle{
          font-size: 16px;
          font-weight: 900;
          text-align: center;
          margin-bottom: 10px;
          letter-spacing: .5px;
          color: #000 !important;
        }

        .izvodMeta{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 10px;
          line-height: 1.5;
        }

        .metaRow{
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .metaLabel{
          color: #000 !important;
          font-weight: 600;
        }

        .metaValue{
          color: #000 !important;
          font-weight: 700;
        }

        .tblWrap{
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 10px;
          margin-top: 16px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }
        .paper .table {
          table-layout: fixed;
          width: 100%;
        }
        .paper .table tbody tr {
          height: auto !important;
        }
        .paper .table tbody td {
          height: auto !important;
          overflow: hidden !important;
          line-height: 1.3;
          padding: 6px 5px;
        }
        .paper .table th.desc {
          width: 28%;
          max-width: 28%;
          box-sizing: border-box;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          min-width: 0;
        }
        .paper .table td.desc,
        .paper .table .desc {
          width: 28%;
          max-width: 28%;
          box-sizing: border-box;
          overflow: hidden !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          line-height: 1.3;
          min-width: 0;
        }
        table{ width:100%; border-collapse:collapse; color: #000; font-size: 9px; }
        thead tr{ background: rgba(0,0,0,.06); }
        th{
          padding: 6px 5px;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .2px;
          color: #000;
          text-align:left;
          border-bottom: 2px solid rgba(0,0,0,.12);
          white-space: normal;
          word-break: break-word;
          font-weight: 800;
        }
        td{
          padding: 6px 5px;
          font-size: 9px;
          border-top: 1px solid rgba(0,0,0,.08);
          vertical-align: top;
          color: #000;
          line-height: 1.3;
          overflow: hidden;
        }
        .num{ text-align:right; white-space:nowrap; font-family: 'Courier New', monospace; color: #000; font-size: 9px; }
        .desc{
          color: #000;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: break-word;
          overflow: hidden;
          min-width: 0;
          max-width: 100%;
          line-height: 1.3;
          font-size: 9px;
        }
        .ref{ font-weight: 600; color: #000; font-size: 9px; }

        .izvodFooter{
          margin-top: 14px;
          padding-top: 12px;
          border-top: 2px solid rgba(0,0,0,.15);
        }

        .footerRow{
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 10px;
          border-top: 1px solid rgba(0,0,0,.06);
        }

        .footerRow:first-child{
          border-top: none;
        }

        .footerLabel{
          color: #000 !important;
          font-weight: 700;
        }

        .footerValue{
          color: #000 !important;
          font-weight: 800;
          font-family: 'Courier New', monospace;
        }

        .footerRow.total{
          border-top: 2px solid rgba(0,0,0,.15);
          margin-top: 8px;
          padding-top: 12px;
        }

        .footerRow.total .footerLabel,
        .footerRow.total .footerValue{
          font-size: 11px;
          font-weight: 900;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          html {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color-scheme: light !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #111111 !important;
          }
          
          .container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .pageWrap {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .topBlock, .divider { 
            display: none !important; 
          }
          
          .body { 
            padding: 0 !important; 
            margin: 0 !important;
            overflow: visible !important;
            flex: none !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .paperStage { 
            padding: 0 !important; 
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          
          .paper {
            width: 210mm !important;
            min-height: 297mm !important;
            max-width: 210mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 18mm 16mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000 !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .paper table,
          .paper th,
          .paper td,
          .paper .num,
          .paper .desc,
          .paper .ref {
            color: #000 !important;
          }
          .paper .tblWrap { overflow: hidden !important; max-width: 100%; }
          .paper .table { font-size: 9px !important; }
          .paper .table th { font-size: 8px !important; padding: 6px 5px !important; }
          .paper .table td { font-size: 9px !important; padding: 6px 5px !important; line-height: 1.3 !important; }
          .paper .table tbody tr { height: auto !important; }
          .paper .table tbody td { overflow: hidden !important; line-height: 1.3 !important; }
          .paper .table th.desc,
          .paper .table td.desc {
            width: 28% !important;
            max-width: 28% !important;
            overflow: hidden !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            line-height: 1.3 !important;
          }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">🏦 {t("izvodi.statementShort")} #{izvod.statement_no || izvod.batch_id}</div>
                  <div className="brandSub">{t("izvodi.overviewSubtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => window.print()}
                  title={t("common.print")}
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.1))",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                    fontWeight: 700,
                  }}
                >
                  🖨️ {t("common.print")}
                </button>
                <Link
                  href="/izvodi"
                  className="btn"
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    fontWeight: 700,
                  }}
                  title={t("izvodi.backToListTitle")}
                >
                  ← {t("izvodi.back")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="body">
          <div className="paperStage">
            <div className="paper">
              {/* Header izvoda */}
              <div className="izvodHeader">
                <div className="izvodTitle">
                  UNICREDIT BANK D.D.
                  <br />
                  {t("izvodi.statementNoLabel")} {izvod.statement_no || "—"}
                </div>
                
                <div className="izvodMeta">
                  <div className="metaRow">
                    <span className="metaLabel">{t("izvodi.date")}</span>
                    <span className="metaValue">{fmtDDMMYYYY(izvod.statement_date)}</span>
                  </div>
                  <div className="metaRow">
                    <span className="metaLabel">{t("izvodi.asOfDate")}</span>
                    <span className="metaValue">{fmtDDMMYYYY(izvod.statement_date)}</span>
                  </div>
                  {izvod.bank_account_no && (
                    <>
                      <div className="metaRow">
                        <span className="metaLabel">{t("izvodi.accountNo")}</span>
                        <span className="metaValue">{izvod.bank_account_no}</span>
                      </div>
                      {isEUR && (
                        <div className="metaRow">
                          <span className="metaLabel">{t("izvodi.iban")}</span>
                          <span className="metaValue">{izvod.bank_account_no}</span>
                        </div>
                      )}
                    </>
                  )}
                  {izvod.company_name && (
                    <div className="metaRow">
                      <span className="metaLabel">{t("izvodi.client")}</span>
                      <span className="metaValue">{izvod.company_name}</span>
                    </div>
                  )}
                  {izvod.tax_id && (
                    <div className="metaRow">
                      <span className="metaLabel">{t("izvodi.taxId")}</span>
                      <span className="metaValue">{izvod.tax_id}</span>
                    </div>
                  )}
                  <div className="metaRow">
                    <span className="metaLabel">{t("izvodi.currency")}</span>
                    <span className="metaValue">{valuta}</span>
                  </div>
                </div>
              </div>

              {/* Tabela transakcija */}
              <div className="tblWrap table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: "10%" }}>{t("izvodi.reference")}</th>
                      {isEUR ? (
                        <>
                          <th style={{ width: "8%" }}>{t("izvodi.dateBook")}</th>
                          <th style={{ width: "8%" }}>{t("izvodi.valueDate")}</th>
                        </>
                      ) : (
                        <th style={{ width: "12%" }}>{t("izvodi.colDate")}</th>
                      )}
                      <th className="desc">{t("izvodi.description")}</th>
                      <th className="num" style={{ width: "11%" }}>{t("izvodi.debit")} ({valuta})</th>
                      <th className="num" style={{ width: "11%" }}>{t("izvodi.credit")} ({valuta})</th>
                      {isEUR && (
                        <>
                          <th className="num" style={{ width: "11%" }}>{t("izvodi.debit")} (BAM)</th>
                          <th className="num" style={{ width: "11%" }}>{t("izvodi.credit")} (BAM)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {transakcije.length === 0 ? (
                      <tr>
                        <td colSpan={isEUR ? 8 : 5} style={{ padding: 20, textAlign: "center", color: "#000" }}>
                          {t("izvodi.noTransactions")}
                        </td>
                      </tr>
                    ) : (
                      transakcije.map((tx) => {
                        const amount = tx.amount || 0;
                        const isDebit = amount < 0;
                        const isCredit = amount > 0;
                        const duguje = isDebit ? Math.abs(amount) : 0;
                        const potrazuje = isCredit ? amount : 0;

                        // Za EUR transakcije, izračunaj BAM ekvivalente
                        let dugujeBAM = 0;
                        let potrazujeBAM = 0;
                        if (isEUR) {
                          // Pokušaj da izvučem amountInBam iz raw_json ako postoji
                          let amountInBam = null;
                          try {
                            // Prvo pokušaj iz raw_json (ako postoji CF_DIN_POT i CF_DIN_DUG)
                            if (tx.raw_json) {
                              const raw = typeof tx.raw_json === 'string' ? JSON.parse(tx.raw_json) : tx.raw_json;
                              if (raw.CF_DIN_POT != null && raw.CF_DIN_DUG != null) {
                                const dinPot = parseFloat(String(raw.CF_DIN_POT).replace(",", "."));
                                const dinDug = parseFloat(String(raw.CF_DIN_DUG).replace(",", "."));
                                amountInBam = dinPot - dinDug;
                              }
                            }
                            
                            // Ako nema u raw_json, pokušaj iz opisa
                            if (amountInBam === null && tx.full_description) {
                              const desc = tx.full_description;
                              // Format: "EXCH KONVERZIJA OPERATIVNI TECAJ 1.95583000 550,00 0,00 1.075,71 0,00"
                              const bamMatch = desc.match(/(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)/);
                              if (bamMatch) {
                                const dinPot = parseFloat(bamMatch[3].replace(",", "."));
                                const dinDug = parseFloat(bamMatch[4].replace(",", "."));
                                amountInBam = dinPot - dinDug;
                              }
                            }
                          } catch (err) {
                            console.warn("Greška pri izvlačenju BAM konverzije:", err);
                          }
                          
                          // Ako nema eksplicitne konverzije, koristi fiksni kurs
                          if (amountInBam === null || !Number.isFinite(amountInBam)) {
                            amountInBam = amount * EUR_TO_BAM;
                          }
                          
                          dugujeBAM = isDebit ? Math.abs(amountInBam) : 0;
                          potrazujeBAM = isCredit ? amountInBam : 0;
                        }

                        return (
                          <tr key={tx.tx_id}>
                            <td className="ref">{tx.reference || "—"}</td>
                            {isEUR ? (
                              <>
                                <td>{fmtDDMMYYYY(tx.value_date)}</td>
                                <td>{fmtDDMMYYYY(tx.value_date)}</td>
                              </>
                            ) : (
                              <td>{fmtDDMMYYYY(tx.value_date)}</td>
                            )}
                            <td className="desc">
                              {tx.full_description || tx.description || "—"}
                              {tx.counterparty && (
                                <div style={{ fontSize: 10, color: "#000", marginTop: 2 }}>
                                  {tx.counterparty}
                                </div>
                              )}
                            </td>
                            <td className="num">
                              {duguje > 0 ? fmtMoney(duguje, valuta) : "—"}
                            </td>
                            <td className="num">
                              {potrazuje > 0 ? fmtMoney(potrazuje, valuta) : "—"}
                            </td>
                            {isEUR && (
                              <>
                                <td className="num">
                                  {dugujeBAM > 0 ? fmtMoney(dugujeBAM, "BAM") : "—"}
                                </td>
                                <td className="num">
                                  {potrazujeBAM > 0 ? fmtMoney(potrazujeBAM, "BAM") : "—"}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer sa prometom i saldom */}
              <div className="izvodFooter">
                {isEUR ? (
                  <React.Fragment>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.turnover")}</span>
                      <span className="footerValue">
                        {fmtMoney(ukupnoDuguje, valuta)} / {fmtMoney(ukupnoPotrazuje, valuta)} / {fmtMoney(ukupnoDugujeBAM, "BAM")} / {fmtMoney(ukupnoPotrazujeBAM, "BAM")}
                      </span>
                    </div>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.openingBalance")}</span>
                      <span className="footerValue">
                        {fmtMoney(izvod.opening_balance, valuta)} / {fmtMoney(stariSaldoBAM, "BAM")}
                      </span>
                    </div>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.turnoverBalance")}</span>
                      <span className="footerValue" style={{ color: saldoPrometa < 0 ? "#d32f2f" : "#1976d2" }}>
                        {saldoPrometa >= 0 ? "+" : ""}{fmtMoney(saldoPrometa, valuta)} / {saldoPrometaBAM >= 0 ? "+" : ""}{fmtMoney(saldoPrometaBAM, "BAM")}
                      </span>
                    </div>
                    <div className="footerRow total">
                      <span className="footerLabel">{t("izvodi.closingBalance")}</span>
                      <span className="footerValue">
                        {fmtMoney(izvod.closing_balance, valuta)} / {fmtMoney(noviSaldoBAM, "BAM")}
                      </span>
                    </div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.turnoverInCurrency")}</span>
                      <span className="footerValue">
                        {fmtMoney(ukupnoDuguje, valuta)} / {fmtMoney(ukupnoPotrazuje, valuta)}
                      </span>
                    </div>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.openingBalance")}</span>
                      <span className="footerValue">
                        {fmtMoney(izvod.opening_balance, valuta)}
                      </span>
                    </div>
                    <div className="footerRow">
                      <span className="footerLabel">{t("izvodi.turnoverBalance")}</span>
                      <span className="footerValue" style={{ color: saldoPrometa < 0 ? "#d32f2f" : "#1976d2" }}>
                        {saldoPrometa >= 0 ? "+" : ""}{fmtMoney(saldoPrometa, valuta)}
                      </span>
                    </div>
                    <div className="footerRow total">
                      <span className="footerLabel">{t("izvodi.closingBalance")}</span>
                      <span className="footerValue">
                        {fmtMoney(izvod.closing_balance, valuta)}
                      </span>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
