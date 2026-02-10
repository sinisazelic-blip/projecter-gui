// src/app/fakture/wizard/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDDMMYYYY(iso: string) {
  if (!iso || iso.length < 10) return "—";
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${d}.${m}.${y}`;
}

export default function InvoiceWizard() {
  const sp = useSearchParams();
  const router = useRouter();

  const idsRaw = String(sp.get("ids") ?? "");
  const ids = useMemo(() => {
    return idsRaw
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [idsRaw]);

  // ✅ minimal state (sutra poliramo detalje + auto-popune iz DB)
  const [invoiceDate, setInvoiceDate] = useState<string>(todayISO());
  const [currency, setCurrency] = useState<string>("KM");
  const [vatMode, setVatMode] = useState<"BH_17" | "INO_0">("BH_17");

  // Fiskalni broj (editable)
  const [fiskalniBroj, setFiskalniBroj] = useState<string>("");

  // Poziv na broj (8 cifara) — zaključali smo koncept
  const [pozivNaBroj, setPozivNaBroj] = useState<string>("");

  // Popust (opciono, NE default)
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountPct, setDiscountPct] = useState<string>("5");
  const [discountHours, setDiscountHours] = useState<string>("48");

  function goPreview() {
    if (ids.length === 0) return;

    const qs = new URLSearchParams();
    qs.set("ids", ids.join(","));
    qs.set("date", invoiceDate);
    qs.set("ccy", currency);
    qs.set("vat", vatMode);
    if (fiskalniBroj.trim()) qs.set("fisk", fiskalniBroj.trim());
    if (pozivNaBroj.trim()) qs.set("pnb", pozivNaBroj.trim());

    if (discountEnabled) {
      qs.set("disc_on", "1");
      qs.set("disc_pct", String(discountPct || "0"));
      qs.set("disc_h", String(discountHours || "0"));
    }

    router.push(`/fakture/wizard/preview?${qs.toString()}`);
  }

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
        .topBlock {
          position: sticky; top:0; z-index: 30;
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
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }

        .scrollWrap { flex:1; overflow:auto; padding: 14px 0 18px; }
        .cardLike { border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 14px; margin-top: 12px; }
        .grid2 { display:grid; grid-template-columns:220px 1fr; gap:10px; align-items:center; }
        @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
        .label { opacity:.75; font-size:13px; }

        .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: inherit;
          outline: none;
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Faktura — Wizard (2/3)</div>
                  <div className="brandSub">Priprema elemenata prije preview-a</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/fakture/za-fakturisanje`} className="btn" title="Nazad na listu">
                  ← Nazad
                </Link>
                <button className="btn" type="button" onClick={goPreview} disabled={ids.length === 0} style={{ opacity: ids.length === 0 ? 0.55 : 1 }}>
                  ➜ Preview (3/3)
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: .8, fontSize: 13 }}>
              Projekti u fakturi: <b>{ids.length}</b> ({ids.slice(0, 12).join(", ")}{ids.length > 12 ? "…" : ""})
            </div>
          </div>
        </div>

        <div className="scrollWrap">
          <div className="container">
            <div className="cardLike">
              <div style={{ fontWeight: 850, fontSize: 16 }}>Osnovno</div>

              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="label">Datum fakture</div>
                <input className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} placeholder="YYYY-MM-DD" />

                <div className="label">Valuta plaćanja</div>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="KM">KM (BAM)</option>
                  <option value="EUR">EUR</option>
                </select>

                <div className="label">PDV režim</div>
                <select className="input" value={vatMode} onChange={(e) => setVatMode(e.target.value as any)}>
                  <option value="BH_17">BiH (PDV 17%)</option>
                  <option value="INO_0">INO (0% VAT)</option>
                </select>

                <div className="label">Fiskalni broj (opciono)</div>
                <input className="input" value={fiskalniBroj} onChange={(e) => setFiskalniBroj(e.target.value)} placeholder="npr. 00012345" />

                <div className="label">Poziv na broj (8 cifara)</div>
                <input className="input" value={pozivNaBroj} onChange={(e) => setPozivNaBroj(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="8 cifara" />
              </div>

              <div style={{ marginTop: 10, opacity: .8, fontSize: 12 }}>
                * Datum fakture: {fmtDDMMYYYY(invoiceDate)} · Poziv na broj mora biti samo brojevi (8 cifara).
              </div>
            </div>

            <div className="cardLike">
              <div style={{ fontWeight: 850, fontSize: 16 }}>Popust (opciono)</div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <input type="checkbox" checked={discountEnabled} onChange={(e) => setDiscountEnabled(e.target.checked)} />
                Aktiviraj popust (samo kad ti odlučiš)
              </label>

              {discountEnabled ? (
                <div className="grid2" style={{ marginTop: 10 }}>
                  <div className="label">Popust (%)</div>
                  <input className="input" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="npr. 5" />

                  <div className="label">Vrijedi (sati)</div>
                  <input className="input" value={discountHours} onChange={(e) => setDiscountHours(e.target.value)} placeholder="npr. 48" />
                </div>
              ) : (
                <div style={{ marginTop: 8, opacity: .75, fontSize: 12 }}>
                  Popust se ne prikazuje dok ga ne uključiš.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
