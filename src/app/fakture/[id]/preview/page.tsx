// src/app/fakture/[id]/preview/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  const label = ccy === "KM" ? "KM" : ccy;
  return `${s} ${label}`;
}

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
  return (
    s === "bih" || s === "bosna i hercegovina" || s === "bosnia and herzegovina"
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

  // Grupiši račune po banci
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

  // Formatiraj svaku banku
  const formatted: string[] = [];
  
  for (const [bankName, bankAccounts] of Object.entries(byBank)) {
    const parts: string[] = [bankName];
    
    // Pronađi KM broj računa (bank_racun)
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
    
    // Pronađi IBAN i SWIFT (za EUR/INO račune)
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
    
    // Dodaj (EUR) IBAN i SWIFT ako postoje
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

export default function FakturaPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const fakturaId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faktura, setFaktura] = useState<any>(null);
  const [data, setData] = useState<PreviewData | null>(null);

  // Svi hookovi moraju biti pre bilo kakvih early return-ova
  const buyer = data?.buyer ?? null;
  const firma = data?.firma ?? null;
  const projects = Array.isArray(data?.projects) ? data!.projects : [];

  const bh = useMemo(() => (buyer ? isBiH(buyer.drzava) : true), [buyer]);
  const lang: Lang = useMemo(() => (bh ? "BH" : "EN"), [bh]);
  const docTitle = useMemo(
    () => (lang === "EN" ? "INVOICE" : "RAČUN"),
    [lang],
  );

  const invoiceDateISO = faktura?.datum_izdavanja || "";
  const dueDateISO = faktura?.datum_dospijeca || "";
  const ccy = (faktura?.valuta || "KM").toUpperCase();
  const fisk = faktura?.broj_fiskalni ? String(faktura.broj_fiskalni) : "";
  const invoiceNumber = faktura?.broj_fakture || "—";

  const items = useMemo(
    () =>
      projects.map((p) => {
        const title = String(
          p.radni_naziv ?? `Projekat #${p.projekat_id}`,
        ).trim();
        const sub = p.klijent_naziv ? `Klijent: ${p.klijent_naziv}` : "";
        const qty = 1;
        const unit = Number(p.budzet_planirani ?? 0);
        const total = qty * unit;
        return {
          id: p.projekat_id,
          title,
          sub,
          qty,
          unit,
          total,
          closed_at: p.closed_at,
        };
      }),
    [projects],
  );

  const baseAmount = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (Number.isFinite(it.total) ? it.total : 0),
        0,
      ),
    [items],
  );
  const vatRate = useMemo(() => (bh ? 0.17 : 0), [bh]);
  const vatAmount = useMemo(() => baseAmount * vatRate, [baseAmount, vatRate]);
  const totalAmount = useMemo(
    () => baseAmount + vatAmount,
    [baseAmount, vatAmount],
  );

  const sellerName = String(
    firma?.naziv || firma?.pravni_naziv || "Studio TAF",
  ).trim();
  const sellerAddr1 = String(firma?.adresa ?? "—").trim();
  const sellerCityLine = safeLineJoin(
    [firma?.postanski_broj, firma?.grad],
    " ",
  );
  const sellerCountry = String(firma?.drzava ?? "BiH").trim();
  const sellerTax =
    String(firma?.pdv_broj ?? "").trim() ||
    String(firma?.pib ?? "").trim() ||
    String(firma?.jib ?? "").trim() ||
    "—";

  const bankAccounts = Array.isArray(firma?.bank_accounts)
    ? firma!.bank_accounts
    : [];
  
  // ✅ Formatiraj račune prema traženom formatu
  const formattedBankAccounts = formatBankAccounts(bankAccounts);

  const buyerName = String(
    buyer?.naziv_klijenta ?? (lang === "EN" ? "Buyer" : "Kupac"),
  ).trim();
  const buyerAddr1 = String(buyer?.adresa ?? "—").trim();
  const buyerCityLine = safeLineJoin([buyer?.postanski_broj, buyer?.grad], " ");
  const buyerCountry = String(buyer?.drzava ?? "—").trim();
  const buyerTax = String(buyer?.porezni_id ?? "—").trim();

  useEffect(() => {
    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      setError("Neispravan ID fakture");
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Učitaj fakturu
        const fakturaRes = await fetch(`/api/fakture/${fakturaId}`, {
          cache: "no-store",
        });
        const fakturaData = await fakturaRes.json();

        if (!fakturaRes.ok || !fakturaData.ok) {
          throw new Error(fakturaData.error || "Greška pri učitavanju fakture");
        }

        setFaktura(fakturaData.faktura);

        // Učitaj podatke za preview (projekti, buyer, firma)
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
        setError(err?.message || "Greška");
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
          Učitavanje...
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
            ← Nazad na listu faktura
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
          color: #111111;
          border-radius: 12px;
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
          border: 1px solid rgba(0,0,0,.08);
          padding: 18mm 16mm;
        }
        @media (max-width: 980px){
          .paper{ width: min(100%, 210mm); padding: 16px; }
        }

        .invRow{ display:flex; gap:14px; justify-content:space-between; align-items:flex-start; }
        .invHeaderLeft{ display:flex; align-items:flex-start; gap:12px; }
        .companyLogo{ max-height: 105px; max-width: 276px; object-fit: contain; }

        .docTitle{ font-size: 22px; font-weight: 800; letter-spacing: .6px; text-align:right; margin: 0; }

        .meta{ margin-top: 8px; font-size: 12px; line-height: 1.35; text-align:right; color: #222; }
        .meta .line{ display:flex; justify-content:flex-end; gap:10px; }
        .meta .k{ min-width: 140px; color:#555; text-align:right; }
        .meta .kStrong{ font-weight: 850; color:#111; }
        .meta .v{ font-weight: 650; color:#111; }

        .hr{ height: 1px; background: rgba(0,0,0,.10); margin: 14px 0; }

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
          color:#111;
          text-transform: uppercase;
        }
        .addr{ font-size: 12px; line-height: 1.4; color:#222; }
        .addr .name{ font-weight: 750; color:#111; }
        .addr .muted{ color:#555; }
        .addr .bankList{ margin-top: 8px; }
        .addr .bankLine{ color:#333; margin-top: 3px; }

        .tblWrap{
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 10px;
          overflow:hidden;
          margin-top: 14px;
        }
        table{ width:100%; border-collapse:collapse; }
        thead tr{ background: rgba(0,0,0,.03); }
        th{
          padding: 10px 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .35px;
          color:#555;
          text-align:left;
          border-bottom: 1px solid rgba(0,0,0,.10);
          white-space: nowrap;
        }
        td{
          padding: 10px 10px;
          font-size: 12px;
          border-top: 1px solid rgba(0,0,0,.08);
          vertical-align: top;
        }
        .num{ text-align:right; white-space:nowrap; }
        .desc{ color:#111; font-weight: 650; }
        .mutedSmall{ font-size: 11px; color:#666; margin-top: 2px; }

        .totalsRow{
          display:flex;
          justify-content:flex-end;
          gap: 18px;
          margin-top: 8px;
        }

        .totalsBox{
          width: 50%;
          max-width: 320px;
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .totLine{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          font-size: 12px;
          padding: 6px 0;
          border-top: 1px solid rgba(0,0,0,.06);
        }
        .totLine:first-child{ border-top: none; }
        .totLine .k{ color:#555; }
        .totLine .v{ font-weight: 650; }
        .totLine.total .k{ color:#111; font-weight: 800; }
        .totLine.total .v{ font-weight: 900; }

        .completedLine{
          margin-top: 6px;
          font-size: 10px;
          color:#555;
          line-height: 1.25;
        }

        .footer{
          margin-top: 18px;
          padding-top: 10px;
          border-top: 1px solid rgba(0,0,0,.08);
          font-size: 11px;
          color: #666;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          flex-wrap: wrap;
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
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 18mm 16mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #111111 !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          .cols2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">📄 Faktura #{invoiceNumber}</div>
                  <div className="brandSub">Pregled fakture</div>
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
                  title="Nazad na listu faktura"
                >
                  ← Nazad
                </Link>
                
                <button
                  className="btn"
                  onClick={() => window.print()}
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.1))",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                    fontWeight: 600,
                  }}
                  title="Štampaj fakturu"
                >
                  🖨️ Štampaj
                </button>
                
                <button
                  className="btn"
                  onClick={() => {
                    window.print();
                  }}
                  style={{
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.1))",
                    borderColor: "rgba(168, 85, 247, 0.4)",
                    fontWeight: 600,
                  }}
                  title="Sačuvaj kao PDF (koristi Save as PDF u print dialogu)"
                >
                  💾 Save as PDF
                </button>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="body">
          <div className="paperStage">
            <div className="paper">
              <div className="invRow">
                <div className="invHeaderLeft">
                  <img
                    src="/firma/taf-logo.jpg"
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
                      <div className="v">{ccy}</div>
                    </div>
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "PFR No." : "PFR broj"}
                      </div>
                      <div className="v">{fisk ? fisk : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="cols2">
                <div>
                  <div className="blockTitle">
                    {lang === "EN" ? "Seller" : "Prodavac"}
                  </div>
                  <div className="addr">
                    <div className="name">{sellerName}</div>
                    {sellerAddr1 !== "—" && <div>{sellerAddr1}</div>}
                    {sellerCityLine && <div>{sellerCityLine}</div>}
                    {sellerCountry && <div>{sellerCountry}</div>}
                    <div className="muted">
                      {lang === "EN" ? "Tax ID:" : "PIB:"} {sellerTax}
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
                    {lang === "EN" ? "Buyer" : "Kupac"}
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
                        {lang === "EN" ? "Tax ID:" : "PIB:"} {buyerTax}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="tblWrap">
                <table>
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
                <div className="totalsBox">
                  <div className="totLine">
                    <div className="k">
                      {lang === "EN" ? "Subtotal" : "Osnovica"}
                    </div>
                    <div className="v">{fmtMoney(baseAmount, ccy)}</div>
                  </div>
                  {vatRate > 0 && (
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
                      {lang === "EN" ? "Total" : "Ukupno"}
                    </div>
                    <div className="v">{fmtMoney(totalAmount, ccy)}</div>
                  </div>
                </div>
              </div>

              <div className="footer">
                <div>
                  {lang === "EN"
                    ? "Thank you for your business!"
                    : "Hvala na saradnji!"}
                </div>
                <div className="fluxaSig">
                  <img src="/fluxa/logo-icon.png" alt="FLUXA" />
                  <span>FLUXA</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
