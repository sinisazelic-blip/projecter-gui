// src/app/fakture/wizard/preview/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDDMMYYYY(iso: string) {
  if (!iso || iso.length < 10) return "—";
  const y = iso.slice(0, 4), m = iso.slice(5, 7), d = iso.slice(8, 10);
  return `${d}.${m}.${y}`;
}

const TAX_EXEMPTION_TEXT =
  "Tax exemption: According to the VAT Law, this service is exempt from VAT pursuant to Article 27, paragraph 1.";

export default function PreviewPage() {
  const sp = useSearchParams();

  const idsRaw = String(sp.get("ids") ?? "");
  const ids = useMemo(() => idsRaw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0), [idsRaw]);

  const date = String(sp.get("date") ?? "");
  const ccy = String(sp.get("ccy") ?? "KM");
  const vat = String(sp.get("vat") ?? "BH_17");
  const fisk = String(sp.get("fisk") ?? "");
  const pnb = String(sp.get("pnb") ?? "");

  const discOn = String(sp.get("disc_on") ?? "") === "1";
  const discPct = String(sp.get("disc_pct") ?? "");
  const discH = String(sp.get("disc_h") ?? "");

  // ✅ placeholder: sutra vežemo na stvarne stavke i iznose iz DB
  const [dummyAmount, setDummyAmount] = useState<number>(0);

  const isINO = vat === "INO_0";
  const title = isINO ? "Invoice" : "Račun";

  function finalizeDisabled() {
    return ids.length === 0;
  }

  async function finalize() {
    // sutra: POST /api/fakture/create (snimi u DB + prebaci projekte na status 9)
    alert("Finalizacija dolazi u sljedećem koraku (API create). Preview je spreman.");
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

        .paper {
          max-width: 900px;
          margin: 0 auto;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.04);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          padding: 18px;
        }

        .row { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .muted { opacity:.78; }
        .h1 { font-size: 22px; font-weight: 900; margin:0; }
        .box {
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.04);
          border-radius: 14px;
          padding: 12px;
          min-width: 260px;
        }
        .tbl { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .tbl th, .tbl td { border-bottom: 1px solid rgba(255,255,255,.10); padding: 10px 8px; }
        .tbl th { text-align:left; opacity: .85; font-size: 13px; }
        .num { text-align:right; white-space:nowrap; }
        .footerNote { margin-top: 14px; font-size: 12px; opacity: .75; text-align:center; }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Faktura — Preview (3/3)</div>
                  <div className="brandSub">Konačni pregled prije kreiranja</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/fakture/wizard?ids=${encodeURIComponent(ids.join(","))}`} className="btn">
                  ← Nazad (2/3)
                </Link>
                <button className="btn" type="button" onClick={finalize} disabled={finalizeDisabled()} style={{ opacity: finalizeDisabled() ? 0.55 : 1 }}>
                  🔴 Kreiraj fakturu
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: .8, fontSize: 13 }}>
              Projekti: <b>{ids.length}</b> · Datum: <b>{fmtDDMMYYYY(date)}</b> · Valuta: <b>{ccy}</b> · PDV: <b>{isINO ? "0%" : "17%"}</b>
            </div>
          </div>
        </div>

        <div className="scrollWrap">
          <div className="paper">
            {/* Header fakture */}
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* ✅ Logo firme (NE Fluxa) */}
                <img src="/firma/taf-logo.jpg" alt="Firma logo" style={{ height: 54, width: "auto", borderRadius: 8 }} />
                <div>
                  <div className="h1">{title}</div>
                  <div className="muted">Preview — finalni izgled</div>
                </div>
              </div>

              <div className="box">
                <div style={{ fontWeight: 900 }}>{title} broj: <span className="muted">— (dodjeljuje se kod kreiranja)</span></div>
                <div style={{ marginTop: 6 }}>Datum: <b>{fmtDDMMYYYY(date)}</b></div>
                <div style={{ marginTop: 6 }}>Poziv na broj: <b>{pnb || "—"}</b></div>
                <div style={{ marginTop: 6 }}>Fiskalni broj: <b>{fisk || "—"}</b></div>
              </div>
            </div>

            {/* Kupac / Prodavac */}
            <div className="row" style={{ marginTop: 12 }}>
              <div className="box" style={{ flex: "1 1 360px" }}>
                <div style={{ fontWeight: 900 }}>Prodavac</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  (dolazi iz modula Firma — sutra vežemo podatke)
                </div>
              </div>

              <div className="box" style={{ flex: "1 1 360px" }}>
                <div style={{ fontWeight: 900 }}>Kupac</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  (Naručilac / Klijent — sutra vežemo podatke)
                </div>
              </div>
            </div>

            {/* Projekat završen */}
            <div style={{ marginTop: 12, opacity: .9 }}>
              {ids.length <= 1 ? (
                <div><b>Projekat je završen</b> dd.mm.yyyy</div>
              ) : (
                <div><b>Posljednji projekat je završen</b> dd.mm.yyyy</div>
              )}
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                (datum dolazi iz zatvaranja projekta — status 8)
              </div>
            </div>

            {/* Stavke */}
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>R.br.</th>
                  <th>Naziv</th>
                  <th className="num" style={{ width: 90 }}>Količina</th>
                  <th className="num" style={{ width: 140 }}>Jed. cijena</th>
                  <th className="num" style={{ width: 160 }}>Ukupno</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td className="muted">Stavke se sutra automatski popunjavaju iz projekata (radni naziv + “po želji”).</td>
                  <td className="num">1</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
              </tbody>
            </table>

            {/* Sažetak */}
            <div className="row" style={{ marginTop: 12, alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 360px" }}>
                {isINO ? (
                  <div style={{ fontSize: 13, opacity: .92 }}>
                    <div style={{ fontWeight: 900 }}>Tax exemption</div>
                    <div style={{ marginTop: 6 }}>{TAX_EXEMPTION_TEXT}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      This invoice was generated electronically and is valid without signature and stamp.
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Račun je generisan elektronskim putem i važi bez potpisa i pečata.
                  </div>
                )}

                {discOn ? (
                  <div style={{ marginTop: 10, fontSize: 13, opacity: .92 }}>
                    Popust: <b>{discPct}%</b> ako je plaćanje u roku <b>{discH}h</b>.
                  </div>
                ) : null}
              </div>

              <div className="box" style={{ flex: "0 0 320px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Ukupno</span>
                  <b>{dummyAmount.toFixed(2)} {ccy}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span>PDV</span>
                  <b>{isINO ? "0.00" : (dummyAmount * 0.17).toFixed(2)} {ccy}</b>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,.12)", margin: "10px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                  <span>Za plaćanje</span>
                  <span>{(isINO ? dummyAmount : dummyAmount * 1.17).toFixed(2)} {ccy}</span>
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  * Protuvrijednost u KM se prikazuje kad valuta nije KM (sutra vežemo kurs).
                </div>

                {/* mali “dummy” kontrola da vidiš format (sutra ide realni iznos) */}
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>test iznos:</span>
                  <input
                    value={String(dummyAmount)}
                    onChange={(e) => setDummyAmount(Number(e.target.value || 0))}
                    style={{
                      width: 120,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,.18)",
                      background: "rgba(255,255,255,.06)",
                      color: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Fluxa footer */}
            <div className="footerNote">
              Made by <b>FLUXA Project &amp; Finance Engine</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
