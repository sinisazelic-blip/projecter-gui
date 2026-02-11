// src/app/fakture/wizard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayDDMMYYYY() {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ddmmyyyyToISO(ddmmyyyy: string): string | null {
  const s = String(ddmmyyyy || "").trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  if (!(yyyy >= 2000 && yyyy <= 2100)) return null;
  if (!(mm >= 1 && mm <= 12)) return null;

  const maxDay = new Date(yyyy, mm, 0).getDate();
  if (!(dd >= 1 && dd <= maxDay)) return null;

  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

export default function InvoiceWizard() {
  const sp = useSearchParams();
  const router = useRouter();

  // ✅ čitamo ids (novo) + pid (fallback)
  const ids = useMemo(() => {
    const idsRaw = String(sp.get("ids") ?? "").trim();
    if (idsRaw) {
      return idsRaw
        .split(",")
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    }

    const pid = sp.get("pid");
    const n = Number(pid);
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }, [sp]);

  // Datum u UI je dd.mm.yyyy (kao što tražiš)
  const [invoiceDateDD, setInvoiceDateDD] = useState<string>(todayDDMMYYYY());

  // Osnovno (ostavljam kako je bilo)
  const [currency, setCurrency] = useState<string>("KM");
  const [vatMode, setVatMode] = useState<"BH_17" | "INO_0">("BH_17");

  // Fiskalni/PFR (editable, ostavljam)
  const [pfrBroj, setPfrBroj] = useState<string>("");

  // ✅ Poziv na broj: AUTO, read-only
  const [pozivNaBroj, setPozivNaBroj] = useState<string>("");
  const [pnbLoading, setPnbLoading] = useState<boolean>(false);
  const [pnbErr, setPnbErr] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function run() {
      setPnbErr("");
      if (ids.length === 0) {
        setPozivNaBroj("");
        return;
      }

      setPnbLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("ids", ids.join(","));
        const res = await fetch(`/api/fakture/wizard/seed?${qs.toString()}`, {
          cache: "no-store",
        });
        const j = await res.json();

        if (!res.ok || j?.ok === false) {
          throw new Error(j?.error ?? "Seed API error");
        }

        const p = String(j?.poziv_na_broj ?? "");
        if (!/^\d{8}$/.test(p)) {
          throw new Error("Poziv na broj nije validan (mora biti 8 cifara).");
        }

        if (alive) setPozivNaBroj(p);
      } catch (e: any) {
        if (alive) {
          setPozivNaBroj("");
          setPnbErr(e?.message ?? "Greška kod generisanja poziva na broj");
        }
      } finally {
        if (alive) setPnbLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [ids]);

  function goPreview() {
    if (ids.length === 0) return;

    const iso = ddmmyyyyToISO(invoiceDateDD);
    if (!iso) {
      alert("Datum fakture mora biti u formatu dd.mm.yyyy");
      return;
    }

    if (!/^\d{8}$/.test(pozivNaBroj)) {
      alert("Poziv na broj nije generisan ili nije validan.");
      return;
    }

    const qs = new URLSearchParams();
    qs.set("ids", ids.join(","));
    qs.set("date", iso);
    qs.set("ccy", currency);
    qs.set("vat", vatMode);

    if (pfrBroj.trim()) qs.set("pfr", pfrBroj.trim());

    // ✅ AUTO poziv na broj ide uvijek
    qs.set("pnb", pozivNaBroj);

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

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          min-width: 120px;
          text-align: center;
          white-space: nowrap;
          border-radius: 14px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.03);
          font-weight: 650;
          color: inherit;
        }
        .btn:hover { border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.05); }

        .hint { margin-top: 10px; opacity: .8; fontSize: 12px; }
        .err {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,80,80,.35);
          background: rgba(255,80,80,.10);
          color: rgba(255,220,220,.92);
          font-size: 12px;
          line-height: 1.35;
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
                  <div className="brandTitle">Faktura — Wizard (2/3)</div>
                  <div className="brandSub">
                    Priprema elemenata prije preview-a
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={`/fakture/za-fakturisanje`}
                  className="btn"
                  title="Nazad na listu"
                >
                  ← Nazad
                </Link>
                <button
                  className="btn"
                  type="button"
                  onClick={goPreview}
                  disabled={
                    ids.length === 0 ||
                    pnbLoading ||
                    !/^\d{8}$/.test(pozivNaBroj)
                  }
                  style={{ opacity: ids.length === 0 || pnbLoading ? 0.55 : 1 }}
                  title={
                    ids.length === 0
                      ? "Nema selekcije"
                      : pnbLoading
                        ? "Generišem poziv na broj…"
                        : "Preview"
                  }
                >
                  ➜ Preview (3/3)
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
              Projekti u fakturi: <b>{ids.length}</b> (
              {ids.slice(0, 12).join(", ")}
              {ids.length > 12 ? "…" : ""})
            </div>
          </div>
        </div>

        <div className="scrollWrap">
          <div className="container">
            <div className="cardLike">
              <div style={{ fontWeight: 850, fontSize: 16 }}>Osnovno</div>

              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="label">Datum fakture (dd.mm.yyyy)</div>
                <input
                  className="input"
                  value={invoiceDateDD}
                  onChange={(e) => setInvoiceDateDD(e.target.value)}
                  placeholder="dd.mm.yyyy"
                />

                <div className="label">Valuta plaćanja</div>
                <select
                  className="input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="KM">KM (BAM)</option>
                  <option value="EUR">EUR</option>
                </select>

                <div className="label">PDV režim</div>
                <select
                  className="input"
                  value={vatMode}
                  onChange={(e) => setVatMode(e.target.value as any)}
                >
                  <option value="BH_17">BiH (PDV 17%)</option>
                  <option value="INO_0">INO (0% VAT)</option>
                </select>

                <div className="label">PFR broj (opciono)</div>
                <input
                  className="input"
                  value={pfrBroj}
                  onChange={(e) => setPfrBroj(e.target.value)}
                  placeholder="—"
                />

                <div className="label">Poziv na broj (AUTO, 8 cifara)</div>
                <input
                  className="input"
                  value={pnbLoading ? "Generišem…" : pozivNaBroj}
                  readOnly
                  disabled
                  style={{ opacity: 0.9 }}
                />
              </div>

              {pnbErr ? <div className="err">{pnbErr}</div> : null}

              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                * Poziv na broj generiše Fluxa automatski (ne ručno). Datum se
                unosi kao <b>dd.mm.yyyy</b>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
