// src/app/fakture/wizard/preview/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  naziv_klijenta: string | null;
  tip_klijenta: string | null;
  porezni_id: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj?: string | null;
  drzava: string | null;
  rok_placanja_dana: number | null;
  is_ino?: number | boolean;
};

type ApiFirma = {
  firma_id: number;
  is_active: number;
  naziv: string | null;
  pravni_naziv: string | null;
  adresa: string | null;
  grad: string | null;
  postanski_broj: string | null;
  drzava: string | null;
  telefon: string | null;
  email: string | null;
  web: string | null;
  jib: string | null;
  pib: string | null;
  pdv_broj: string | null;
  broj_rjesenja: string | null;
  bank_naziv: string | null;
  bank_racun: string | null;
  swift: string | null;
  iban: string | null;
  logo_path: string | null;
  bank_accounts?: any[];
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
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

function fmtBankLine(acc: any): string {
  const bank = String(
    acc?.bank_naziv ?? acc?.banka_naziv ?? acc?.bank ?? acc?.naziv_bank ?? "",
  ).trim();
  const account = String(
    acc?.bank_racun ??
      acc?.racun ??
      acc?.broj_racuna ??
      acc?.account_no ??
      acc?.account ??
      "",
  ).trim();
  const iban = String(acc?.iban ?? "").trim();
  const swift = String(acc?.swift ?? acc?.bic ?? "").trim();

  const chunks: string[] = [];
  if (bank) chunks.push(bank);
  if (account) chunks.push(account);
  if (iban) chunks.push(`IBAN ${iban}`);
  if (swift) chunks.push(`SWIFT ${swift}`);

  const out = chunks.join(" · ");
  return out || "—";
}

export default function Page() {
  const sp = useSearchParams();

  const ids = useMemo(() => parseIds(String(sp.get("ids") ?? "")), [sp]);

  const invoiceDateISO = sp.get("date") ?? "";
  const dueDateISO = sp.get("due") ?? "";
  const ccy = (sp.get("ccy") ?? "KM").toUpperCase();
  const fisk = sp.get("fisk") ?? "";
  const pnb = sp.get("pnb") ?? "";

  const [data, setData] = useState<PreviewData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("ids", ids.join(","));
        const res = await fetch(
          `/api/fakture/wizard/preview-data?${qs.toString()}`,
          { cache: "no-store" },
        );
        const j = (await res.json()) as PreviewData;
        if (alive) setData(j);
      } catch (e: any) {
        if (alive)
          setData({
            ok: false,
            ids,
            projects: [],
            buyer: null,
            firma: null,
            narucioc_count: 0,
            error: e?.message ?? "Error",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ids.join(",")]);

  const buyer = data?.buyer ?? null;
  const firma = data?.firma ?? null;
  const projects = Array.isArray(data?.projects) ? data!.projects : [];

  const bh = useMemo(() => (buyer ? isBiH(buyer.drzava) : true), [buyer]);
  const lang: Lang = useMemo(() => (bh ? "BH" : "EN"), [bh]);
  const docTitle = useMemo(
    () => (lang === "EN" ? "INVOICE" : "RAČUN"),
    [lang],
  );

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

  const lastClosed = useMemo(
    () =>
      (items
        .map((x) => x.closed_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] as string | undefined),
    [items],
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

  const buyerName = String(
    buyer?.naziv_klijenta ?? (lang === "EN" ? "Buyer" : "Kupac"),
  ).trim();
  const buyerAddr1 = String(buyer?.adresa ?? "—").trim();
  const buyerCityLine = safeLineJoin([buyer?.postanski_broj, buyer?.grad], " ");
  const buyerCountry = String(buyer?.drzava ?? "—").trim();
  const buyerTax = String(buyer?.porezni_id ?? "—").trim();

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

        .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

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

        /* ✅ manji razmak prije obračuna */
        .totalsRow{
          display:flex;
          justify-content:flex-end;
          gap: 18px;
          margin-top: 8px; /* was 14px */
        }

        .totalsBox{
          min-width: 320px;
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

        /* ✅ Info line unutar obračuna (umjesto između tabele i obračuna) */
        .completedLine{
          margin-top: 10px;
          font-size: 11px;
          color:#555;
          line-height: 1.35;
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
          .topBlock, .divider { display:none !important; }
          .body { padding: 0 !important; }
          .paperStage { padding: 0 !important; }
          .paper{
            width: auto !important;
            min-height: auto !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
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
                  <div className="brandTitle">
                    {lang === "EN"
                      ? "Invoice preview (3/3)"
                      : "Preview računa (3/3)"}
                  </div>
                  <div className="brandSub">
                    {lang === "EN"
                      ? "Paper simulation — this is how the PDF/print will look."
                      : "Paper simulacija — ovako izgleda PDF/štampa."}
                  </div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href="/dashboard" title="Dashboard">
                  ← Dashboard
                </Link>

                <Link
                  className="btn"
                  href={`/fakture/wizard?ids=${encodeURIComponent(ids.join(","))}`}
                  title="Nazad na wizard"
                >
                  ← {lang === "EN" ? "Back (2/3)" : "Nazad (2/3)"}
                </Link>

                <button
                  type="button"
                  className="btn"
                  onClick={() => window.print()}
                  title={lang === "EN" ? "Print" : "Štampaj"}
                >
                  🖨 {lang === "EN" ? "Print" : "Štampaj"}
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
                      <div className="v">—</div>
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
                        {dueDateISO ? fmtDDMMYYYYFromISO(dueDateISO) : "—"}
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
                    <div className="line">
                      <div className="k">
                        {lang === "EN" ? "Payment reference" : "Poziv na broj"}
                      </div>
                      <div className="v">{pnb ? pnb : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="cols2">
                <div>
                  <div className="blockTitle">
                    {lang === "EN" ? "Legal entity" : "PRAVNO LICE"}
                  </div>
                  <div className="addr">
                    <div className="name">{sellerName}</div>
                    <div className="muted">{sellerAddr1}</div>
                    {sellerCityLine ? (
                      <div className="muted">{sellerCityLine}</div>
                    ) : null}
                    <div className="muted">{sellerCountry}</div>
                    <div className="muted">PIB/PDV: {sellerTax}</div>

                    {bankAccounts.length ? (
                      <div className="bankList">
                        <div className="muted" style={{ marginTop: 8 }}>
                          Bankovni računi:
                        </div>
                        {bankAccounts.map((acc, i) => (
                          <div
                            key={String(acc?.bank_account_id ?? i)}
                            className="bankLine"
                          >
                            • {fmtBankLine(acc)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="blockTitle">
                    {lang === "EN"
                      ? "Buyer / Ordering party"
                      : "KLIJENT/NARUČILAC"}
                  </div>
                  <div className="addr">
                    <div className="name">{buyerName}</div>
                    <div className="muted">{buyerAddr1}</div>
                    {buyerCityLine ? (
                      <div className="muted">{buyerCityLine}</div>
                    ) : null}
                    <div className="muted">{buyerCountry}</div>
                    <div className="muted">PIB/PDV: {buyerTax}</div>
                  </div>
                </div>
              </div>

              <div className="tblWrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th>
                        {lang === "EN"
                          ? "Service / Project"
                          : "USLUGA / PROJEKAT"}
                      </th>
                      <th className="num" style={{ width: 72 }}>
                        {lang === "EN" ? "Qty" : "KOL."}
                      </th>
                      <th className="num" style={{ width: 120 }}>
                        {lang === "EN" ? "Unit price" : "JED. CIJENA"}
                      </th>
                      <th className="num" style={{ width: 120 }}>
                        {lang === "EN" ? "Total" : "UKUPNO"}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 14, color: "#666" }}>
                          {lang === "EN"
                            ? "No selected projects."
                            : "Nema izabranih projekata."}
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="desc">{it.title}</div>
                            {it.sub ? (
                              <div className="mutedSmall">{it.sub}</div>
                            ) : null}
                          </td>
                          <td className="num">{it.qty}</td>
                          <td className="num">{fmtMoney(it.unit, ccy)}</td>
                          <td className="num">{fmtMoney(it.total, ccy)}</td>
                        </tr>
                      ))
                    )}
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

                  <div className="totLine">
                    <div className="k">{lang === "EN" ? "VAT" : "PDV"}</div>
                    <div className="v">
                      {bh ? fmtMoney(vatAmount, ccy) : "—"}
                    </div>
                  </div>

                  <div className="totLine total">
                    <div className="k">
                      {lang === "EN" ? "Total due" : "Ukupno za plaćanje"}
                    </div>
                    <div className="v">{fmtMoney(totalAmount, ccy)}</div>
                  </div>

                  {/* ✅ Proj completion ovdje, da se “rupa” iznad obračuna zatvori */}
                  <div className="completedLine">
                    {lang === "EN"
                      ? `Project completed: ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`
                      : `Projekat je završen ${lastClosed ? fmtDDMMYYYYFromISO(lastClosed) : "—"}`}
                  </div>

                  {!bh ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "#555",
                        lineHeight: 1.35,
                      }}
                    >
                      VAT exemption: In accordance with the VAT Law, this
                      service is exempt from VAT pursuant to Article 27,
                      paragraph 1.
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: "#555",
                      lineHeight: 1.35,
                    }}
                  >
                    {lang === "EN"
                      ? "This invoice was generated electronically and is valid without signature and stamp."
                      : "Račun je generisan elektronskim putem i važeći je bez pečata i potpisa."}
                  </div>
                </div>
              </div>

              <div className="footer">
                <div className="fluxaSig">
                  <img src="/fluxa/Icon.png" alt="FLUXA" />
                  <span>Made by FLUXA Project &amp; Finance Engine</span>
                </div>

                <div style={{ color: "#777" }}>
                  {lang === "EN" ? "Preview only" : "Samo preview"} ·{" "}
                  {lang === "EN" ? "not yet finalized" : "nije finalizovano"}
                </div>
              </div>

              {!data?.ok ? (
                <div style={{ marginTop: 12, fontSize: 11, color: "#b00" }}>
                  {data?.error ? `API error: ${data.error}` : "API not ready"}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
