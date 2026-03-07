// src/app/ponuda/[id]/preview/PonudaPreviewClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

function fmtDDMMYYYYFromISO(isoLike: string | null): string {
  if (!isoLike) return "—";
  const s = String(isoLike);
  const y = s.slice(0, 4);
  const m = s.slice(5, 7);
  const d = s.slice(8, 10);
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d))
    return "—";
  return `${d}.${m}.${y}`;
}

function fmtMoney(n: number, ccy: string) {
  const v = Number.isFinite(n) ? n : 0;
  const s = v.toFixed(2);
  const label = ccy === "BAM" || ccy === "KM" ? "KM" : ccy;
  return `${s} ${label}`;
}

function safeLineJoin(
  parts: Array<string | null | undefined>,
  sep = ", ",
): string {
  return parts.filter((p) => p != null && String(p).trim() !== "").join(sep);
}

function isBiH(drzava: any): boolean {
  const s = String(drzava ?? "").trim().toLowerCase();
  if (!s) return true;
  return (
    s === "bih" ||
    s === "ba" ||
    s === "bosna i hercegovina" ||
    s === "bosnia and herzegovina"
  );
}

type Lang = "BH" | "EN";

function formatBankAccounts(accounts: any[]): string[] {
  if (!accounts || accounts.length === 0) return [];
  const byBank: Record<string, any[]> = {};
  for (const acc of accounts) {
    const bankName = String(acc?.bank_naziv ?? acc?.bank ?? "").trim();
    if (!bankName) continue;
    if (!byBank[bankName]) byBank[bankName] = [];
    byBank[bankName].push(acc);
  }
  const formatted: string[] = [];
  for (const [bankName, bankAccounts] of Object.entries(byBank)) {
    const parts: string[] = [bankName];
    let kmAccount = "";
    for (const acc of bankAccounts) {
      const account = String(acc?.bank_racun ?? acc?.racun ?? "").trim();
      if (account && !account.toUpperCase().startsWith("BA")) {
        kmAccount = account;
        break;
      }
    }
    if (kmAccount) parts.push(`(KM) ${kmAccount}`);
    let iban = "";
    let swift = "";
    for (const acc of bankAccounts) {
      const accIban = String(acc?.iban ?? "").trim();
      if (accIban && accIban.toUpperCase().startsWith("BA")) iban = accIban;
      if (!swift) swift = String(acc?.swift ?? acc?.bic ?? "").trim();
    }
    if (iban) parts.push(`(EUR) IBAN ${iban}`);
    if (swift) parts.push(`SWIFT ${swift}`);
    formatted.push(parts.join(" - "));
  }
  return formatted;
}

type PonudaRow = {
  ponuda_id: number;
  inicijacija_id: number;
  broj_ponude: string;
  datum_izdavanja: string;
  datum_vazenja: string;
  klijent_id: number;
  valuta: string;
  popust_km?: number | null;
};

type StavkaRow = {
  ponuda_stavka_id: number;
  naziv_snapshot: string;
  jedinica_snapshot: string | null;
  kolicina: number;
  cijena_jedinicna: number;
  valuta: string;
  opis: string | null;
  line_total: number;
};

type KlijentRow = {
  klijent_id: number;
  naziv_klijenta: string;
  adresa: string | null;
  grad: string | null;
  postanski_broj?: string | null;
  drzava: string | null;
  porezni_id: string | null;
  email: string | null;
  is_ino?: number;
};

type FirmaRow = {
  firma_id: number;
  naziv: string | null;
  pravni_naziv: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string | null;
  pdv_broj: string | null;
  pib: string | null;
  jib: string | null;
  logo_path: string | null;
  bank_accounts?: any[];
};

export default function PonudaPreviewClient() {
  const params = useParams();
  const { t } = useTranslation();
  const id = Number(params?.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ponuda, setPonuda] = useState<PonudaRow | null>(null);
  const [stavke, setStavke] = useState<StavkaRow[]>([]);
  const [klijent, setKlijent] = useState<KlijentRow | null>(null);
  const [firma, setFirma] = useState<FirmaRow | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const ccy = useMemo(
    () => (ponuda?.valuta ? String(ponuda.valuta).toUpperCase() : "KM"),
    [ponuda?.valuta],
  );
  const displayCcy = ccy === "BAM" ? "KM" : ccy;

  const osnovica = useMemo(() => {
    let sum = 0;
    for (const st of stavke) {
      const v = Number(st.line_total);
      sum += Number.isFinite(v) ? v : 0;
    }
    return Math.round(sum * 100) / 100;
  }, [stavke]);

  const popustKm = useMemo(
    () => Math.round((Number(ponuda?.popust_km) || 0) * 100) / 100,
    [ponuda?.popust_km],
  );
  const osnovicaZaPdv = useMemo(
    () => Math.round((osnovica - popustKm) * 100) / 100,
    [osnovica, popustKm],
  );

  const bh = useMemo(() => {
    if (!klijent) return true;
    if (klijent.is_ino === true || klijent.is_ino === 1) return false;
    return isBiH(klijent.drzava);
  }, [klijent]);
  const lang: Lang = useMemo(() => (bh ? "BH" : "EN"), [bh]);
  const pdvRate = useMemo(() => (bh ? 0.17 : 0), [bh]);
  const pdvIznos = useMemo(
    () => (pdvRate > 0 ? Math.round(osnovicaZaPdv * pdvRate * 100) / 100 : 0),
    [osnovicaZaPdv, pdvRate],
  );
  const ukupnoZaPlacanje = useMemo(
    () => Math.round((osnovicaZaPdv + pdvIznos) * 100) / 100,
    [osnovicaZaPdv, pdvIznos],
  );

  const sellerName = useMemo(
    () => String(firma?.naziv || firma?.pravni_naziv || "Studio").trim(),
    [firma],
  );
  const sellerAddr = useMemo(
    () =>
      safeLineJoin([firma?.adresa, safeLineJoin([firma?.grad, firma?.drzava], " ")]),
    [firma],
  );
  const sellerTax = useMemo(
    () =>
      String(firma?.pdv_broj ?? "").trim() ||
      String(firma?.pib ?? "").trim() ||
      String(firma?.jib ?? "").trim() ||
      "—",
    [firma],
  );
  const formattedBankAccounts = useMemo(
    () => formatBankAccounts(Array.isArray(firma?.bank_accounts) ? firma!.bank_accounts : []),
    [firma?.bank_accounts],
  );
  const buyerName = useMemo(
    () =>
      String(
        klijent?.naziv_klijenta ?? t("ponude.previewBuyerFallback"),
      ).trim(),
    [klijent, t],
  );
  const buyerAddr = useMemo(
    () =>
      safeLineJoin([
        klijent?.adresa,
        safeLineJoin([klijent?.postanski_broj, klijent?.grad], " "),
        klijent?.drzava,
      ]),
    [klijent],
  );

  const pdfFilename = useMemo(() => {
    const broj = String(ponuda?.broj_ponude ?? "")
      .replace(/\//g, "-")
      .trim();
    const narucilac = String(buyerName ?? "")
      .replace(/[/\\:*?"<>|]/g, "_")
      .trim() || "nepoznat";
    return `${broj || "ponuda"} ${narucilac}`;
  }, [ponuda?.broj_ponude, buyerName]);

  const mailtoBody = useMemo(() => {
    const broj = ponuda?.broj_ponude ?? "";
    const issueDate = fmtDDMMYYYYFromISO(ponuda?.datum_izdavanja ?? null);
    const validUntil = fmtDDMMYYYYFromISO(ponuda?.datum_vazenja ?? null);
    const lines: string[] = [
      (t("ponude.previewMailtoQuote") || "").replace("{{broj}}", broj),
      (t("ponude.previewMailtoIssueDate") || "").replace("{{date}}", issueDate),
      (t("ponude.previewMailtoValidUntil") || "").replace("{{date}}", validUntil),
      "",
      t("ponude.previewMailtoItems"),
      ...stavke.map(
        (s) =>
          `- ${s.naziv_snapshot}: ${s.kolicina} x ${s.cijena_jedinicna} ${displayCcy} = ${fmtMoney(Number(s.line_total), displayCcy)}`,
      ),
      "",
      (t("ponude.previewMailtoSubtotal") || "").replace("{{amount}}", fmtMoney(osnovica, displayCcy)),
      ...(popustKm > 0
        ? [(t("ponude.previewMailtoDiscount") || "").replace("{{amount}}", fmtMoney(popustKm, displayCcy))]
        : []),
      ...(pdvRate > 0
        ? [(t("ponude.previewMailtoVat") || "").replace("{{amount}}", fmtMoney(pdvIznos, displayCcy))]
        : []),
      (t("ponude.previewMailtoTotalDue") || "").replace("{{amount}}", fmtMoney(ukupnoZaPlacanje, displayCcy)),
    ];
    return encodeURIComponent(lines.join("\r\n"));
  }, [
    t,
    ponuda,
    stavke,
    osnovica,
    popustKm,
    pdvRate,
    pdvIznos,
    ukupnoZaPlacanje,
    displayCcy,
  ]);

  const mailtoHref = useMemo(() => {
    const email = klijent?.email?.trim();
    if (!email) return null;
    const subj = encodeURIComponent(
      (t("ponude.previewMailtoSubject") || "").replace("{{broj}}", ponuda?.broj_ponude ?? ""),
    );
    return `mailto:${email}?subject=${subj}&body=${mailtoBody}`;
  }, [klijent?.email, ponuda?.broj_ponude, mailtoBody, t]);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError(t("ponude.invalidId"));
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ponude/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || t("ponude.loadError"));
        }
        setPonuda(data.ponuda);
        setStavke(Array.isArray(data.stavke) ? data.stavke : []);
        setKlijent(data.klijent ?? null);
        setFirma(data.firma ?? null);
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

  function handlePrint() {
    const prevTitle = document.title;
    document.title = pdfFilename;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 500);
  }

  async function handleSaveAsPdf() {
    const el = paperRef.current;
    if (!el) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${pdfFilename}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            hotfixes: ["px_scaling"],
          },
        })
        .from(el)
        .save();
    } catch (err: any) {
      console.error("PDF greška:", err);
      alert(err?.message || t("ponude.pdfError"));
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
          {t("ponude.loading")}
        </div>
      </div>
    );
  }

  if (error || !ponuda) {
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
          ⚠️ {error || t("ponude.notFound")}
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/inicijacije" className="btn">
            ← {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  const dealId = (ponuda as any).inicijacija_id;

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
        }
        .topInner { padding: 0 14px; }
        .topRow { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandTitle { font-size: 18px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .btn {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          padding: 10px 12px;
          border-radius: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn:hover { background: rgba(255,255,255,.09); }
        .divider { height:1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }
        .body { flex:1; min-height:0; overflow:auto; padding: 18px 0 28px; }
        .paperStage{ display:flex; justify-content:center; padding: 0 10px; }
        .paper{
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          color: #000000;
          border-radius: 0;
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
          border: none;
          padding: 18mm 16mm;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        @media (max-width: 980px){ .paper{ width: min(100%, 210mm); padding: 16px; } }
        .invRow{ display:flex; gap:14px; justify-content:space-between; align-items:flex-start; }
        .invHeaderLeft{ display:flex; align-items:flex-start; gap:12px; }
        .companyLogo{ max-height: 105px; max-width: 276px; object-fit: contain; }
        .docTitle{ font-size: 22px; font-weight: 800; letter-spacing: .6px; text-align:right; margin: 0; color: #000 !important; }
        .meta{ margin-top: 8px; font-size: 12px; line-height: 1.35; text-align:right; color: #000 !important; }
        .meta .line{ display:flex; justify-content:flex-end; gap:10px; }
        .meta .k{ min-width: 140px; color:#000 !important; text-align:right; }
        .meta .kStrong{ font-weight: 850; color:#000 !important; }
        .meta .v{ font-weight: 650; color:#000 !important; }
        .hr{ height: 1px; background: #000 !important; margin: 14px 0; }
        .cols2{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 760px){ .cols2{ grid-template-columns: 1fr; } }
        .cols2 > div:last-child { text-align: right; }
        .cols2 > div:last-child .blockTitle { text-align: right; }
        .blockTitle{ font-size: 12px; font-weight: 800; letter-spacing: .3px; margin-bottom: 6px; color:#000 !important; text-transform: uppercase; }
        .addr{ font-size: 12px; line-height: 1.4; color:#000 !important; }
        .addr .name{ font-weight: 750; color:#000 !important; }
        .addr .muted{ color:#000 !important; }
        .addr .bankList{ margin-top: 8px; }
        .addr .bankLine{ color:#000 !important; margin-top: 3px; }
        .tblWrap{ overflow:hidden; margin-top: 14px; }
        table{ width:100%; border-collapse:collapse; }
        thead tr{ background: #F7F7F7 !important; }
        th{ padding: 10px 10px !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: .35px !important; color:#000 !important; font-weight: 700 !important; text-align:left !important; border-bottom: 1px solid #000 !important; white-space: nowrap !important; background: #F7F7F7 !important; }
        td{ padding: 10px 10px !important; font-size: 12px !important; vertical-align: top !important; color:#000 !important; }
        .num{ text-align:right !important; white-space:nowrap !important; color:#000 !important; }
        .desc{ color:#000 !important; font-weight: 650 !important; }
        .mutedSmall{ font-size: 11px !important; color:#000 !important; margin-top: 2px !important; }
        .totalsRow{ display:flex; justify-content:flex-end; gap: 18px; margin-top: 8px; }
        .totalsBox{ width: 50%; max-width: 320px; border: 1px solid #000 !important; background: #F7F7F7 !important; padding: 10px 12px !important; }
        .totLine{ display:flex !important; justify-content:space-between !important; gap: 12px !important; font-size: 12px !important; padding: 6px 0 !important; border-top: 1px solid rgba(0,0,0,.06) !important; }
        .totLine:first-child{ border-top: none !important; }
        .totLine .k{ color:#000 !important; }
        .totLine .v{ font-weight: 650 !important; color:#000 !important; }
        .totLine.total .k{ color:#000 !important; font-weight: 800 !important; }
        .totLine.total .v{ font-weight: 900 !important; color:#000 !important; }
        .footer{ margin-top: 18px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,.08); font-size: 11px; color: #666; display:flex; align-items:center; justify-content:space-between; gap: 10px; flex-wrap: wrap; }
        .fluxaSig{ display:inline-flex; align-items:center; gap: 6px; opacity: .75; }
        .fluxaSig img{ height: 12px; width: 12px; object-fit: contain; opacity: .85; }
        @media print {
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html { background: #ffffff !important; color-scheme: light !important; margin: 0 !important; padding: 0 !important; }
          body { margin: 0 !important; width: 100% !important; height: auto !important; background: #ffffff !important; color: #111111 !important; }
          .container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          .pageWrap { display: block !important; height: auto !important; overflow: visible !important; background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
          .topBlock, .divider { display: none !important; }
          .body { padding: 0 !important; margin: 0 !important; overflow: visible !important; flex: none !important; background: #ffffff !important; }
          .paperStage { padding: 0 !important; margin: 0 !important; display: block !important; width: 100% !important; background: #ffffff !important; }
          .paper { width: 210mm !important; min-height: 297mm !important; max-width: 210mm !important; box-sizing: border-box !important; overflow-x: hidden !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; padding: 18mm 16mm !important; margin: 0 auto !important; background: #ffffff !important; color: #000000 !important; page-break-inside: auto; }
          .meta, .meta .k, .meta .v, .meta .kStrong { color: #000 !important; }
          .blockTitle, .addr, .addr .name, .addr .muted, .addr .bankLine { color: #000 !important; }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div>
                  <div className="brandTitle">
                    📄 {t("ponude.quote")} {ponuda.broj_ponude}
                  </div>
                  <div className="brandSub">
                    {t("ponude.quotePreview")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href={dealId ? `/inicijacije/${dealId}` : "/inicijacije"}
                  className="btn"
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    fontWeight: 700,
                  }}
                  title={t("common.back")}
                >
                  ← {t("common.back")}
                </Link>
                <button
                  className="btn"
                  onClick={handlePrint}
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.1))",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                    fontWeight: 600,
                  }}
                  title={t("ponude.stampajPonudu")}
                >
                  🖨️ {t("ponude.print")}
                </button>
                <button
                  className="btn"
                  onClick={handleSaveAsPdf}
                  style={{
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.1))",
                    borderColor: "rgba(168, 85, 247, 0.4)",
                    fontWeight: 600,
                  }}
                  title={(t("ponude.downloadPdfTitle") || "").replace("{{filename}}", pdfFilename)}
                >
                  💾 {t("ponude.saveAsPdf")}
                </button>
                {mailtoHref && (
                  <a
                    href={mailtoHref}
                    className="btn"
                    style={{
                      background: "linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.1))",
                      borderColor: "rgba(234, 179, 8, 0.4)",
                      fontWeight: 600,
                    }}
                    title={t("ponude.sendByEmailTitle")}
                  >
                    ✉️ {t("ponude.sendByEmail")}
                  </a>
                )}
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>

        <div className="body">
          <div className="paperStage">
            <div className="paper" ref={paperRef}>
              <div className="invRow">
                <div className="invHeaderLeft">
                  <img
                    src={
                      firma?.logo_path?.trim() && firma.logo_path.startsWith("http")
                        ? firma.logo_path
                        : "/api/firma/logo"
                    }
                    alt="Logo"
                    className="companyLogo"
                  />
                </div>
                <div>
                  <h1 className="docTitle">
                    {t("ponude.previewDocTitle")}
                  </h1>
                  <div className="meta">
                    <div className="line">
                      <div className="k kStrong">{t("ponude.previewQuoteNo")}</div>
                      <div className="v">{ponuda.broj_ponude}</div>
                    </div>
                    <div className="line">
                      <div className="k">{t("ponude.previewIssueDate")}</div>
                      <div className="v">
                        {fmtDDMMYYYYFromISO(ponuda.datum_izdavanja)}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">{t("ponude.previewValidUntil")}</div>
                      <div className="v">
                        {fmtDDMMYYYYFromISO(ponuda.datum_vazenja)}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">{t("ponude.previewCurrency")}</div>
                      <div className="v">{displayCcy}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="cols2">
                <div>
                  <div className="blockTitle">
                    {t("ponude.previewLegalEntity")}
                  </div>
                  <div className="addr">
                    <div className="name">{sellerName}</div>
                    {sellerAddr && <div>{sellerAddr}</div>}
                    <div className="muted">
                      {t("ponude.previewTaxId")} {sellerTax}
                    </div>
                    {formattedBankAccounts.length > 0 && (
                      <div className="bankList">
                        <div style={{ fontWeight: 700, marginTop: 6 }}>
                          {t("ponude.previewBankAccounts")}
                        </div>
                        {formattedBankAccounts.map((line, i) => (
                          <div key={i} className="bankLine">
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="blockTitle">
                    {t("ponude.previewClient")}
                  </div>
                  <div className="addr">
                    <div className="name">{buyerName}</div>
                    {buyerAddr && <div>{buyerAddr}</div>}
                    {klijent?.porezni_id && (
                      <div className="muted">
                        {t("ponude.previewTaxId")} {klijent.porezni_id}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="tblWrap table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("ponude.previewServiceProject")}</th>
                      <th className="num">{t("ponude.previewQty")}</th>
                      <th className="num">{t("ponude.previewUnitPrice")}</th>
                      <th className="num">{t("ponude.previewTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stavke.map((s, idx) => (
                      <tr key={s.ponuda_stavka_id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className="desc">{s.naziv_snapshot}</div>
                          {s.opis && (
                            <div className="mutedSmall">{s.opis}</div>
                          )}
                        </td>
                        <td className="num">{Number(s.kolicina)}</td>
                        <td className="num">
                          {fmtMoney(Number(s.cijena_jedinicna), displayCcy)}
                        </td>
                        <td className="num">
                          {fmtMoney(Number(s.line_total), displayCcy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totalsRow">
                <div className="totalsBox">
                  <div className="totLine">
                    <span className="k">{t("ponude.previewSubtotal")}</span>
                    <span className="v">{fmtMoney(osnovica, displayCcy)}</span>
                  </div>
                  {popustKm > 0 && (
                    <div className="totLine">
                      <span className="k">{t("ponude.previewDiscount")}</span>
                      <span className="v">−{fmtMoney(popustKm, displayCcy)}</span>
                    </div>
                  )}
                  <div className="totLine">
                    <span className="k">
                      {(t("ponude.previewVatPct") || "").replace("{{pct}}", (pdvRate * 100).toFixed(0))}
                    </span>
                    <span className="v">
                      {pdvRate > 0
                        ? fmtMoney(pdvIznos, displayCcy)
                        : fmtMoney(0, displayCcy)}
                    </span>
                  </div>
                  <div className="totLine total">
                    <span className="k">{t("ponude.previewTotalDue")}</span>
                    <span className="v">{fmtMoney(ukupnoZaPlacanje, displayCcy)}</span>
                  </div>
                </div>
              </div>

              {!bh && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: "#000",
                    lineHeight: 1.25,
                  }}
                >
                  {t("ponude.previewVatExempt")}
                </div>
              )}

              <div className="footer">
                <div>
                  {t("ponude.previewFooterGenerated")}
                </div>
                <div className="fluxaSig">
                  <img src="/fluxa/Icon.png" alt="FLUXA" />
                  <span>Made by FLUXA Project &amp; Finance Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
