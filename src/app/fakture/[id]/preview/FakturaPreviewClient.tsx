// src/app/fakture/[id]/preview/FakturaPreviewClient.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

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
  const label = (ccy === "BAM" || ccy === "KM") ? "KM" : ccy;
  return `${s} ${label}`;
}

const EUR_TO_BAM = 1.95583;

function parseIds(idsRaw: string): number[] {
  return String(idsRaw || "")
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function isBiH(drzava: any): boolean {
  const s = String(drzava ?? "")
    .trim()
    .toLowerCase();
  if (!s) return true; // prazno = domaći (BiH)
  return (
    s === "bih" ||
    s === "ba" ||
    s === "bosna i hercegovina" ||
    s === "bosnia and herzegovina"
  );
}

type Lang = "BH" | "EN";

type ApiProject = {
  projekat_id: number;
  radni_naziv: string | null;
  narucilac_id: number | null;
  narucilac_naziv: string | null;
  narucilac_drzava: string | null;
  krajnji_klijent_id: number | null;
  klijent_naziv: string | null;
  budzet_planirani: number | null;
  closed_at: string | null;
};

type ApiBuyer = {
  klijent_id: number;
  naziv_klijenta: string;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string | null;
  porezni_id: string | null;
  jib?: string | null;
  email: string | null;
  telefon: string | null;
  rok_placanja_dana: number | null;
  is_ino?: boolean;
};

type ApiFirma = {
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
  bank_accounts: Array<{
    bank_account_id: number;
    bank_naziv: string | null;
    bank_racun: string | null;
    iban: string | null;
    swift: string | null;
  }>;
};

type PreviewData = {
  ok: boolean;
  ids: number[];
  projects: ApiProject[];
  buyer: ApiBuyer | null;
  firma: ApiFirma | null;
  narucioc_count: number;
  error?: string;
};

function safeLineJoin(
  parts: Array<string | null | undefined>,
  sep = ", ",
): string {
  return parts.filter((p) => p != null && String(p).trim() !== "").join(sep);
}

// ✅ Formatiraj bankovne račune prema traženom formatu: Naziv banke - (KM) broj - (EUR) IBAN - SWIFT
function formatBankAccounts(accounts: any[]): string[] {
  if (!accounts || accounts.length === 0) return [];

  const byBank: Record<string, any[]> = {};

  for (const acc of accounts) {
    const bankName = String(
      acc?.bank_naziv ?? acc?.banka_naziv ?? acc?.bank ?? acc?.naziv_bank ?? "",
    ).trim();

    if (!bankName) continue;

    if (!byBank[bankName]) {
      byBank[bankName] = [];
    }
    byBank[bankName].push(acc);
  }

  const formatted: string[] = [];

  for (const [bankName, bankAccounts] of Object.entries(byBank)) {
    const parts: string[] = [bankName];

    let kmAccount = "";
    for (const acc of bankAccounts) {
      const account = String(
        acc?.bank_racun ??
        acc?.racun ??
        acc?.broj_racuna ??
        acc?.account_no ??
        acc?.account ??
        "",
      ).trim();
      if (account && !account.toUpperCase().startsWith("BA")) {
        kmAccount = account;
        break;
      }
    }

    if (kmAccount) {
      parts.push(`(KM) ${kmAccount}`);
    }

    let iban = "";
    let swift = "";

    for (const acc of bankAccounts) {
      const accIban = String(acc?.iban ?? "").trim();
      const accSwift = String(acc?.swift ?? acc?.bic ?? "").trim();

      if (accIban && accIban.toUpperCase().startsWith("BA")) {
        iban = accIban;
      }
      if (accSwift && !swift) {
        swift = accSwift;
      }
    }

    if (iban || swift) {
      if (iban) {
        parts.push(`(EUR) IBAN ${iban}`);
      }
      if (swift) {
        parts.push(`SWIFT ${swift}`);
      }
    }

    formatted.push(parts.join(" - "));
  }

  return formatted;
}

export default function FakturaPreviewClient() {
  const params = useParams();
  const { t, locale } = useTranslation();
  const fakturaId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faktura, setFaktura] = useState<any>(null);
  const [data, setData] = useState<PreviewData | null>(null);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [markPaidLoading, setMarkPaidLoading] = useState(false);

  const buyer = data?.buyer ?? null;
  const firma = data?.firma ?? null;
  const projects = Array.isArray(data?.projects) ? data!.projects : [];

  // ✅ Pravilo: INO faktura uvijek mora biti na EN, ali BiH sistem (sr) i dalje pokazuje PFR i koristi BiH zakonsku napomenu.
  const isInoInvoice = Boolean(buyer?.is_ino);
  const isBiHSystem = locale === "sr";
  const lang: Lang = useMemo(
    () => (isInoInvoice ? "EN" : isBiHSystem ? "BH" : "EN"),
    [isInoInvoice, isBiHSystem],
  );
  const isStornoFaktura = faktura?.status === "STORNIRAN" || Number(faktura?.iznos_sa_pdv ?? 0) < 0;
  const docTitle = useMemo(
    () =>
      isStornoFaktura
        ? lang === "EN"
          ? "STORNO INVOICE"
          : "STORNO RAČUN"
        : lang === "EN"
          ? "INVOICE"
          : "RAČUN",
    [lang, isStornoFaktura],
  );

  const invoiceDateISO = faktura?.datum_izdavanja || "";
  const dueDateISO = faktura?.datum_dospijeca || "";
  const ccy = (faktura?.valuta || "KM").toUpperCase();
  const fiskNum = faktura?.broj_fiskalni != null ? Number(faktura.broj_fiskalni) : NaN;
  const fisk = Number.isFinite(fiskNum) && fiskNum > 0 ? String(fiskNum) : "";
  const invoiceNumber = faktura?.broj_fakture || "—";

  const projectSubItems = useMemo(
    () => faktura?.project_sub_items ?? {},
    [faktura?.project_sub_items],
  );
  const projectNames = useMemo(
    () => faktura?.project_names ?? {},
    [faktura?.project_names],
  );

  const stornoSign = isStornoFaktura ? -1 : 1;

  const items = useMemo(
    () =>
      projects.map((p) => {
        const overrideNaziv = projectNames[p.projekat_id];
        const baseTitle = String(
          (overrideNaziv || p.radni_naziv) ?? `Projekat #${p.projekat_id}`,
        ).trim();

        // ✅ Ako radimo za krajnjeg klijenta preko agencije, istakni ga u naslovu:
        // "Xiaomi — Naziv projekta"
        const hasEndClient =
          p.krajnji_klijent_id != null &&
          p.klijent_naziv &&
          String(p.klijent_naziv).trim() !== "" &&
          p.narucilac_id != null &&
          Number(p.krajnji_klijent_id) !== Number(p.narucilac_id);
        const endClientName = hasEndClient ? String(p.klijent_naziv).trim() : "";
        const title = endClientName ? `${endClientName} — ${baseTitle}` : baseTitle;

        // Ako je krajnji klijent već u naslovu, nema potrebe da ga dupliramo u podnaslovu.
        const sub = endClientName ? "" : (p.klijent_naziv ? `Klijent: ${p.klijent_naziv}` : "");
        const subItems = projectSubItems[p.projekat_id] ?? [];
        const qty = 1;
        const unit = Number(p.budzet_planirani ?? 0) * stornoSign;
        const total = qty * unit;
        return {
          id: p.projekat_id,
          title,
          sub,
          subItems,
          qty,
          unit,
          total,
          closed_at: p.closed_at,
        };
      }),
    [projects, projectSubItems, projectNames, stornoSign],
  );

  const fakturaOsnovica = Number(faktura?.iznos_bez_pdv ?? faktura?.osnovica_km ?? 0);
  const fakturaPdv = Number(faktura?.pdv_iznos ?? faktura?.pdv_iznos_km ?? 0);
  const fakturaUkupno = Number(faktura?.iznos_sa_pdv ?? faktura?.iznos_ukupno_km ?? 0);

  const baseAmount = useMemo(() => {
    const fromItems = items.reduce(
      (s, it) => s + (Number.isFinite(it.total) ? it.total : 0),
      0,
    );
    if ((fromItems === 0 || !Number.isFinite(fromItems)) && (fakturaOsnovica !== 0 || fakturaUkupno !== 0)) {
      return fakturaOsnovica;
    }
    return fromItems;
  }, [items, fakturaOsnovica, fakturaUkupno]);
  const vatRate = useMemo(() => (isInoInvoice ? 0 : 0.17), [isInoInvoice]);
  const vatAmount = useMemo(() => {
    if (baseAmount === fakturaOsnovica && fakturaPdv !== 0) return fakturaPdv;
    return Math.round(baseAmount * vatRate * 100) / 100;
  }, [baseAmount, vatRate, fakturaOsnovica, fakturaPdv]);
  const totalAmount = useMemo(() => {
    if (baseAmount === fakturaOsnovica && fakturaUkupno !== 0) return fakturaUkupno;
    return baseAmount + vatAmount;
  }, [baseAmount, vatAmount, fakturaOsnovica, fakturaUkupno]);

  const lastClosed = useMemo(() => {
    const dates = items.map((it) => (it as { closed_at?: string | null }).closed_at).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }, [items]);

  const sellerName = String(
    firma?.naziv || firma?.pravni_naziv || "Studio TAF",
  ).trim();
  const sellerAddr1 = String(firma?.adresa ?? "—").trim();
  const sellerCityLine = safeLineJoin(
    [firma?.postanski_broj, firma?.grad],
    " ",
  );
  const sellerCountry = String(firma?.drzava ?? "BiH").trim();
  const isBhDoc = lang !== "EN";
  const sellerTax = isBhDoc
    ? (String(firma?.jib ?? "").trim() || "—")
    : String(firma?.pdv_broj ?? "").trim() ||
      String(firma?.pib ?? "").trim() ||
      String(firma?.jib ?? "").trim() ||
      "—";

  const bankAccounts = Array.isArray(firma?.bank_accounts)
    ? firma!.bank_accounts
    : [];
  const formattedBankAccounts = formatBankAccounts(bankAccounts);

  const buyerName = String(
    buyer?.naziv_klijenta ?? (lang === "EN" ? "Buyer" : "Kupac"),
  ).trim();
  const buyerAddr1 = String(buyer?.adresa ?? "—").trim();
  const buyerCityLine = safeLineJoin([buyer?.postanski_broj, buyer?.grad], " ");
  const buyerCountry = String(buyer?.drzava ?? "—").trim();
  const buyerTax = isBhDoc
    ? (String(buyer?.jib ?? "").trim() || "—")
    : String(buyer?.porezni_id ?? "—").trim();

  const pdfFilename = useMemo(() => {
    const broj = String(invoiceNumber || "").replace(/\//g, "-").trim() || "faktura";
    const narucilac = String(buyerName || "")
      .replace(/[/\\:*?"<>|]/g, "_")
      .trim() || "nepoznat";
    return `${broj} ${narucilac}`;
  }, [invoiceNumber, buyerName]);

  const paperRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const prevTitle = document.title;
    const onBeforePrint = () => { document.title = pdfFilename; };
    const onAfterPrint = () => {
      document.title = prevTitle;
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    document.title = pdfFilename;
    window.print();
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
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", hotfixes: ["px_scaling"] } as { unit?: string; format?: string | [number, number]; orientation?: "portrait" | "landscape" },
        })
        .from(el)
        .save();
    } catch (err: any) {
      console.error("PDF greška:", err);
      alert(err?.message || t("fakture.pdfError"));
    }
  }

  async function handleStorno() {
    if (stornoLoading || isStornoFaktura) return;
    if (!window.confirm(t("fakture.stornoConfirm")))
      return;
    setStornoLoading(true);
    try {
      const res = await fetch(`/api/fakture/${fakturaId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t("common.error"));
      window.location.href = `/fakture/${data.storno_faktura_id}`;
    } catch (e: any) {
      alert(e?.message ?? t("fakture.stornoError"));
    } finally {
      setStornoLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (markPaidLoading || isStornoFaktura) return;
    const status = String((faktura as any)?.status ?? "").toUpperCase();
    if (status === "PLACENA" || status === "DJELIMICNO") return;
    if (!window.confirm(t("fakture.markAsPaidConfirm"))) return;
    setMarkPaidLoading(true);
    try {
      const res = await fetch(`/api/fakture/${fakturaId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!result?.ok) throw new Error(result?.error || t("fakture.markAsPaidError"));
      const fakturaRes = await fetch(`/api/fakture/${fakturaId}`, { cache: "no-store" });
      const fakturaData = await fakturaRes.json();
      if (fakturaRes.ok && fakturaData?.faktura) setFaktura(fakturaData.faktura);
    } catch (e: any) {
      alert(e?.message ?? t("fakture.markAsPaidError"));
    } finally {
      setMarkPaidLoading(false);
    }
  }

  const canMarkAsPaid =
    !isStornoFaktura &&
    (() => {
      const s = String((faktura as any)?.status ?? "").toUpperCase();
      return s !== "PLACENA" && s !== "DJELIMICNO" && s !== "STORNIRAN" && s !== "ZAMIJENJEN";
    })();

  useEffect(() => {
    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      setError(t("fakture.invalidInvoiceId"));
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const fakturaRes = await fetch(`/api/fakture/${fakturaId}`, {
          cache: "no-store",
        });
        const fakturaData = await fakturaRes.json();

        if (!fakturaRes.ok || !fakturaData.ok) {
          throw new Error(fakturaData.error || "Greška pri učitavanju fakture");
        }

        setFaktura(fakturaData.faktura);

        if (fakturaData.faktura.projekti_ids?.length > 0) {
          const qs = new URLSearchParams();
          qs.set("ids", fakturaData.faktura.projekti_ids.join(","));
          const previewRes = await fetch(
            `/api/fakture/wizard/preview-data?${qs.toString()}`,
            { cache: "no-store" },
          );
          const previewData = await previewRes.json();

          if (previewRes.ok && previewData.ok) {
            setData(previewData);
          }
        }
      } catch (err: any) {
        setError(err?.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [fakturaId]);

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: 40, textAlign: "center", opacity: 0.7 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (error || !faktura) {
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
          ⚠️ {error || "Faktura nije pronađena"}
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/fakture" className="btn">
            ← {t("fakture.nazadNaListuFaktura")}
          </Link>
        </div>
      </div>
    );
  }

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
        @media (max-width: 980px){
          .paper{ width: min(100%, 210mm); padding: 16px; }
        }

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
        
        .cols2 > div:last-child {
          text-align: right;
        }
        .cols2 > div:last-child .blockTitle {
          text-align: right;
        }

        .blockTitle{
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .3px;
          margin-bottom: 6px;
          color:#000 !important;
          text-transform: uppercase;
        }
        .addr{ font-size: 12px; line-height: 1.4; color:#000 !important; }
        .addr .name{ font-weight: 750; color:#000 !important; }
        .addr .muted{ color:#000 !important; }
        .addr .bankList{ margin-top: 8px; }
        .addr .bankLine{ color:#000 !important; margin-top: 3px; }

        .tblWrap{
          overflow:hidden;
          margin-top: 14px;
        }
        table{ width:100%; border-collapse:collapse; }
        thead tr{ background: #F7F7F7 !important; }
        th{
          padding: 10px 10px !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: .35px !important;
          color:#000 !important;
          font-weight: 700 !important;
          text-align:left !important;
          border-bottom: 1px solid #000 !important;
          white-space: nowrap !important;
          background: #F7F7F7 !important;
        }
        td{
          padding: 10px 10px !important;
          font-size: 12px !important;
          vertical-align: top !important;
          color:#000 !important;
        }
        .num{ text-align:right !important; white-space:nowrap !important; color:#000 !important; }
        .desc{ color:#000 !important; font-weight: 650 !important; }
        .mutedSmall{ font-size: 11px !important; color:#000 !important; margin-top: 2px !important; }

        .totalsRow{
          display:flex;
          align-items:flex-start;
          gap: 18px;
          margin-top: 8px;
          width: 100%;
        }
        .fiscalSlot{
          width: 260px;
          min-width: 260px;
          flex-shrink: 0;
        }
        .fiscalBlock{
          border: none !important;
          background: transparent !important;
          padding: 10px 12px !important;
          font-size: 11px !important;
          color: #000 !important;
        }
        .fiscalBlock .fiscalTitle{ font-weight: 800 !important; margin-bottom: 6px !important; }
        .fiscalBlock .fiscalLine{ margin: 4px 0 !important; }
        .fiscalBlock .fiscalEnd{ font-weight: 700 !important; margin-top: 8px !important; }

        .totalsBox{
          width: 50%;
          max-width: 320px;
          flex-shrink: 0;
          margin-left: auto;
          border: 1px solid #000 !important;
          background: #F7F7F7 !important;
          padding: 10px 12px !important;
        }
        .totLine{
          display:flex !important;
          justify-content:space-between !important;
          gap: 12px !important;
          font-size: 12px !important;
          padding: 6px 0 !important;
          border-top: 1px solid rgba(0,0,0,.06) !important;
        }
        .totLine:first-child{ border-top: none !important; }
        .totLine .k{ color:#000 !important; }
        .totLine .v{ font-weight: 650 !important; color:#000 !important; }
        .totLine.total .k{ color:#000 !important; font-weight: 800 !important; }
        .totLine.total .v{ font-weight: 900 !important; color:#000 !important; }

        .completedLine{
          margin-top: 6px !important;
          font-size: 10px !important;
          color:#000 !important;
          line-height: 1.25 !important;
        }

        /* Footer: samo Made by FLUXA, centrirano (kao na originalnim fakturama) */
        .footer{
          margin-top: 18px;
          padding-top: 10px;
          border-top: 1px solid rgba(0,0,0,.08);
          font-size: 11px;
          color: #666;
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 10px;
        }
        .fluxaSig{
          display:inline-flex;
          align-items:center;
          gap: 6px;
          opacity: .75;
        }
        .fluxaSig img{ height: 12px; width: 12px; object-fit: contain; opacity: .85; }

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
            box-sizing: border-box !important;
            overflow-x: hidden !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 18mm 16mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            page-break-inside: auto;
          }
          
          .meta, .meta .k, .meta .v, .meta .kStrong {
            color: #000 !important;
          }
          
          .blockTitle, .addr, .addr .name, .addr .muted, .addr .bankLine {
            color: #000 !important;
          }
          
          .docTitle {
            color: #000 !important;
          }
          
          .hr {
            background: #000 !important;
          }
          
          .cols2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          
          table {
            page-break-inside: auto;
          }
          
          thead tr {
            background: #F7F7F7 !important;
          }
          
          th {
            color: #000 !important;
            font-weight: 700 !important;
            background: #F7F7F7 !important;
            border-bottom: 1px solid #000 !important;
          }
          
          td {
            color: #000 !important;
          }
          
          .num, .desc, .mutedSmall {
            color: #000 !important;
          }
          
          .totalsBox {
            border: 1px solid #000 !important;
            background: #F7F7F7 !important;
          }
          
          .totLine .k, .totLine .v {
            color: #000 !important;
          }
          
          .totLine.total .k, .totLine.total .v {
            color: #000 !important;
          }
          
          .completedLine {
            color: #000 !important;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          .invRow, .cols2, .totalsRow, .totalsBox, .footer {
            page-break-inside: avoid;
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
                  <div className="brandTitle">📄 {t("fakture.previewTitle")} #{invoiceNumber}</div>
                  <div className="brandSub">{t("fakture.previewSub")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href="/fakture"
                  className="btn"
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))",
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    fontWeight: 700,
                  }}
                  title={t("fakture.nazadNaListuFaktura")}
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
                  title={t("fakture.stampajFakturu")}
                >
                  🖨️ {t("fakture.stampaj")}
                </button>
                
                <button
                  className="btn"
                  onClick={handleSaveAsPdf}
                  style={{
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.1))",
                    borderColor: "rgba(168, 85, 247, 0.4)",
                    fontWeight: 600,
                  }}
                  title={`Preuzmi PDF: ${pdfFilename}.pdf`}
                >
                  💾 {t("fakture.saveAsPdf")}
                </button>
              </div>
            </div>

            {!isStornoFaktura && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                {canMarkAsPaid && (
                  <button
                    className="btn"
                    onClick={handleMarkPaid}
                    disabled={markPaidLoading}
                    style={{
                      background: "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.15))",
                      color: "#86efac",
                      border: "1px solid rgba(34, 197, 94, 0.5)",
                      fontWeight: 700,
                      opacity: markPaidLoading ? 0.6 : 1,
                    }}
                    title={t("fakture.markAsPaid")}
                  >
                    {markPaidLoading ? "…" : "✓ " + t("fakture.markAsPaid")}
                  </button>
                )}
                <button
                  className="btn"
                  onClick={handleStorno}
                  disabled={stornoLoading}
                  style={{
                    background: "rgba(220, 38, 38, 0.2)",
                    color: "#fca5a5",
                    border: "1px solid rgba(220, 38, 38, 0.5)",
                    fontWeight: 700,
                    opacity: stornoLoading ? 0.6 : 1,
                  }}
                  title="Storniraj fakturu"
                >
                  {stornoLoading ? "…" : "STORNO"}
                </button>
              </div>
            )}

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
                      (() => {
                        const p = data?.firma?.logo_path?.trim();
                        if (!p) return "/api/firma/logo";
                        if (p.startsWith("http://") || p.startsWith("https://"))
                          return p;
                        return "/api/firma/logo";
                      })()
                    }
                    alt="Company logo"
                    className="companyLogo"
                  />
                </div>

                <div>
                  <h1 className="docTitle">{docTitle}</h1>
                  <div className="meta">
                    <div className="line">
                      <div className="k kStrong">
                        {lang === "EN" ? "Invoice No." : "Broj računa"}
                      </div>
                      <div className="v">{invoiceNumber}</div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Invoice date" : "Datum računa"}
                      </div>
                      <div className="v">
                        {fmtDDMMYYYYFromISO(invoiceDateISO)}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Due date" : "Datum dospijeća"}
                      </div>
                      <div className="v">
                        {dueDateISO
                          ? fmtDDMMYYYYFromISO(dueDateISO)
                          : "—"}
                      </div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Currency" : "Valuta"}
                      </div>
                      <div className="v">{(ccy === "BAM" || ccy === "KM") ? "KM" : ccy}</div>
                    </div>
                    {!fisk ? (
                      <div className="line">
                        <div className="k">
                          {lang === "EN" ? "PFR No." : "PFR broj"}
                        </div>
                        <div className="v">—</div>
                      </div>
                    ) : null}
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Payment ref." : "Poziv na broj"}
                      </div>
                      <div className="v">{faktura?.poziv_na_broj ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="cols2">
                <div>
                  <div className="blockTitle">
                    {lang === "EN" ? "Legal entity" : "Pravno lice"}
                  </div>
                  <div className="addr">
                    <div className="name">{sellerName}</div>
                    {sellerAddr1 !== "—" && <div>{sellerAddr1}</div>}
                    {sellerCityLine && <div>{sellerCityLine}</div>}
                    {sellerCountry && <div>{sellerCountry}</div>}
                    <div className="muted">
                      {lang === "EN" ? "Tax ID:" : "JIB:"} {sellerTax}
                    </div>
                    {formattedBankAccounts.length > 0 && (
                      <div className="bankList">
                        {formattedBankAccounts.map((formatted, i) => (
                          <div key={`bank-${i}`} className="bankLine">
                            {formatted}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="blockTitle">
                    {lang === "EN" ? "Client/Orderer" : "Klijent/Naručilac"}
                  </div>
                  <div className="addr">
                    <div className="name">{buyerName}</div>
                    {buyerAddr1 !== "—" && <div>{buyerAddr1}</div>}
                    {buyerCityLine && <div>{buyerCityLine}</div>}
                    {buyerCountry && buyerCountry !== "—" && (
                      <div>{buyerCountry}</div>
                    )}
                    {buyerTax && buyerTax !== "—" && (
                      <div className="muted">
                        {lang === "EN" ? "Tax ID:" : "JIB:"} {buyerTax}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="tblWrap table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        {lang === "EN" ? "Description" : "Opis"}
                      </th>
                      <th className="num">
                        {lang === "EN" ? "Qty" : "Kol."}
                      </th>
                      <th className="num">
                        {lang === "EN" ? "Unit Price" : "Cijena"}
                      </th>
                      <th className="num">
                        {lang === "EN" ? "Total" : "Ukupno"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          <div className="desc">{it.title}</div>
                          {it.sub && (
                            <div className="mutedSmall">{it.sub}</div>
                          )}
                          {it.subItems && it.subItems.length > 0 && (
                            <ul
                              className="mutedSmall"
                              style={{
                                margin: "6px 0 0 0",
                                paddingLeft: 18,
                                listStyle: "disc",
                                lineHeight: 1.4,
                              }}
                            >
                              {it.subItems.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="num">{it.qty}</td>
                        <td className="num">
                          {fmtMoney(it.unit, ccy)}
                        </td>
                        <td className="num">
                          {fmtMoney(it.total, ccy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totalsRow">
                {fisk ? (
                  <div className="fiscalSlot">
                    <div className="fiscalBlock">
                      <div className="fiscalTitle">
                        {String((faktura as any)?.status ?? "").toUpperCase() === "DODIJELJEN"
                          ? "FISKALNI RAČUN JE U PRILOGU"
                          : "FISKALNI RAČUN"}
                      </div>
                      <div className="fiscalLine">PFR br.rač: {fisk}</div>
                    </div>
                  </div>
                ) : null}
                <div className="totalsBox">
                  <div className="totLine">
                    <div className="k">
                      {lang === "EN" ? "Subtotal" : "Osnovica"}
                    </div>
                    <div className="v">{fmtMoney(baseAmount, ccy)}</div>
                  </div>
                  {(vatRate > 0 || isInoInvoice) && (
                    <>
                      <div className="totLine">
                        <div className="k">
                          {lang === "EN"
                            ? `VAT (${(vatRate * 100).toFixed(0)}%)`
                            : `PDV (${(vatRate * 100).toFixed(0)}%)`}
                        </div>
                        <div className="v">{fmtMoney(vatAmount, ccy)}</div>
                      </div>
                    </>
                  )}
                  <div className="totLine total">
                    <div className="k">
                      {lang === "EN"
                        ? t("wizard.previewDoc.en.totalDue")
                        : t("wizard.previewDoc.bh.totalDue")}
                    </div>
                    <div
                      className="v"
                      style={
                        isInoInvoice && String(ccy).trim() === "EUR"
                          ? { display: "flex", flexDirection: "column", alignItems: "flex-end" }
                          : undefined
                      }
                    >
                      {fmtMoney(totalAmount, ccy)}
                      {isInoInvoice && String(ccy).trim() === "EUR" ? (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 9,
                            color: "#555",
                            lineHeight: 1.25,
                            fontWeight: 500,
                            textAlign: "right",
                            width: "100%",
                          }}
                        >
                          BAM equivalent: {(Math.round(totalAmount * EUR_TO_BAM * 100) / 100).toFixed(2)} BAM
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="completedLine">
                    {lang === "EN"
                      ? `${t("wizard.previewDoc.en.projectCompleted")} ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`
                      : `${t("wizard.previewDoc.bh.projectCompleted")} ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`}
                  </div>

                  {/* INO fakture BiH: obavezna rečenica o oslobođenju PDV-a */}
                  {lang === "EN" && isBiHSystem && (vatRate === 0 || isInoInvoice) ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "#555",
                        lineHeight: 1.25,
                      }}
                    >
                      {t("wizard.previewDoc.en.vatExemptionBiH")}
                    </div>
                  ) : lang === "EN" && vatRate === 0 ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "#555",
                        lineHeight: 1.25,
                      }}
                    >
                      {t("wizard.previewDoc.en.vatExemption")}
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: "#555",
                      lineHeight: 1.25,
                    }}
                  >
                    {lang === "EN"
                      ? t("wizard.previewDoc.en.generatedElectronically")
                      : t("wizard.previewDoc.bh.generatedElectronically")}
                  </div>
                </div>
              </div>

              <div className="footer">
                <div className="fluxaSig">
                  <img src="/fluxa/Icon.png" alt="FLUXA" />
                  <span>{t(`wizard.previewDoc.${lang === "EN" ? "en" : "bh"}.madeByFluxa`)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
