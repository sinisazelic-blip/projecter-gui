// src/app/studio/firma/page.js
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function pick(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function accOrEmpty(accs, idx) {
  return accs?.[idx] || { bank_naziv: "", bank_racun: "", iban: "", swift: "", primary_rank: null };
}

export default async function Page({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const saved = String(sp?.saved ?? "") === "1";

  const firmaRows = await query(
    `
    SELECT *
    FROM firma_profile
    WHERE is_active = 1
    ORDER BY firma_id DESC
    LIMIT 1
    `
  );

  const f = firmaRows?.[0] || null;

  const accs = f?.firma_id
    ? await query(
        `
        SELECT bank_account_id, bank_naziv, bank_racun, iban, swift, primary_rank
        FROM firma_bank_accounts
        WHERE firma_id = ?
        ORDER BY bank_account_id ASC
        `,
        [f.firma_id]
      )
    : [];

  const a1 = accOrEmpty(accs, 0);
  const a2 = accOrEmpty(accs, 1);
  const a3 = accOrEmpty(accs, 2);

  // default primary: ako postoji primary_rank=1 na nekom, inače 1
  const primaryIdx =
    accs?.findIndex((x) => Number(x?.primary_rank) === 1) >= 0
      ? String(accs.findIndex((x) => Number(x?.primary_rank) === 1) + 1)
      : "1";

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    color: "inherit",
    outline: "none",
    width: "100%",
  };

  const labelStyle = { fontSize: 12, opacity: 0.75, marginBottom: 6 };
  const row2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
  const row3 = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 };

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
        .topBlock{
          position: sticky; top:0; z-index:30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .topRow{
          display:flex; justify-content:space-between; gap:12px;
          align-items:center; flex-wrap:wrap;
        }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .divider { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 0; }

        .bodyWrap { flex:1; min-height:0; overflow:auto; padding: 14px 0 18px; }
        .card{
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          padding: 14px;
        }

        .sectionTitle { font-weight: 850; letter-spacing: .2px; margin: 0 0 10px 0; }
        .hint { font-size: 12px; opacity: .72; margin-top: 6px; }

        .ok {
          border: 1px solid rgba(80, 220, 140, .30);
          background: rgba(80, 220, 140, .10);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          opacity: .92;
          margin-bottom: 12px;
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
        }

        .btnRow { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top: 14px; }
        .muted { opacity:.75; font-size:12px; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; }

        .bankCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.02);
          border-radius: 16px;
          padding: 12px;
          margin-top: 10px;
        }
        .bankHead {
          display:flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          font-size: 12px; font-weight: 750;
          white-space: nowrap;
          opacity: .9;
        }

        @media (max-width: 900px) {
          .twoCol, .threeCol { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Firma</div>
                  <div className="brandSub">Identitet studija (kanonski profil za potpise i fakture)</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href="/dashboard" className="btn">Dashboard</Link>
                <Link href="/narudzbenice" className="btn">Narudžbenice</Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <div className="card">
            {saved ? <div className="ok">✅ Sačuvano. Ovaj profil je sada aktivan.</div> : null}

            <div className="sectionTitle">Osnovno</div>

            <form action="/api/firma/save" method="POST">
              <div className="twoCol" style={row2}>
                <div>
                  <div style={labelStyle}>Naziv (obavezno)</div>
                  <input name="naziv" defaultValue={pick(f?.naziv) || "Studio TAF"} style={inputStyle} required />
                  <div className="hint">Ovo ide u potpis (npr. Studio TAF).</div>
                </div>

                <div>
                  <div style={labelStyle}>Pravni naziv</div>
                  <input name="pravni_naziv" defaultValue={pick(f?.pravni_naziv)} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div className="threeCol" style={row3}>
                <div>
                  <div style={labelStyle}>Email</div>
                  <input name="email" defaultValue={pick(f?.email)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Telefon</div>
                  <input name="telefon" defaultValue={pick(f?.telefon)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Web</div>
                  <input name="web" defaultValue={pick(f?.web)} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 18 }} />

              <div className="sectionTitle">Adresa</div>

              <div className="twoCol" style={row2}>
                <div>
                  <div style={labelStyle}>Adresa</div>
                  <input name="adresa" defaultValue={pick(f?.adresa)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Grad</div>
                  <input name="grad" defaultValue={pick(f?.grad)} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div className="threeCol" style={row3}>
                <div>
                  <div style={labelStyle}>Poštanski broj</div>
                  <input name="postanski_broj" defaultValue={pick(f?.postanski_broj)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Država</div>
                  <input name="drzava" defaultValue={pick(f?.drzava)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Logo path</div>
                  <input name="logo_path" defaultValue={pick(f?.logo_path) || "/fluxa/logo-light.png"} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 18 }} />

              <div className="sectionTitle">Porezni i registri</div>

              <div className="threeCol" style={row3}>
                <div>
                  <div style={labelStyle}>JIB</div>
                  <input name="jib" defaultValue={pick(f?.jib)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>PIB</div>
                  <input name="pib" defaultValue={pick(f?.pib)} style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>PDV broj</div>
                  <input name="pdv_broj" defaultValue={pick(f?.pdv_broj)} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div>
                <div style={labelStyle}>Broj rješenja (registracija)</div>
                <input name="broj_rjesenja" defaultValue={pick(f?.broj_rjesenja)} style={inputStyle} />
              </div>

              <div style={{ height: 18 }} />

              <div className="sectionTitle">Banke / računi</div>
              <div className="hint">
                Firma može imati više računa. Po BiH pravilima mora postojati tačno jedan <b>glavni</b> račun (radio).
              </div>

              {/* ✅ hidden: da API zna koji je “glavni” */}
              <input type="hidden" name="primary_idx_default" value={primaryIdx} />

              {[1, 2, 3].map((i) => {
                const a = i === 1 ? a1 : i === 2 ? a2 : a3;
                return (
                  <div key={i} className="bankCard">
                    <div className="bankHead">
                      <div className="pill">Račun #{i}</div>

                      <label className="pill" style={{ cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="primary_idx"
                          value={String(i)}
                          defaultChecked={String(primaryIdx) === String(i)}
                          style={{ marginRight: 8 }}
                        />
                        Glavni račun
                      </label>
                    </div>

                    <div className="twoCol" style={row2}>
                      <div>
                        <div style={labelStyle}>Naziv banke</div>
                        <input name={`bank_naziv_${i}`} defaultValue={pick(a.bank_naziv)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Račun</div>
                        <input name={`bank_racun_${i}`} defaultValue={pick(a.bank_racun)} style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ height: 10 }} />

                    <div className="twoCol" style={row2}>
                      <div>
                        <div style={labelStyle}>IBAN</div>
                        <input name={`iban_${i}`} defaultValue={pick(a.iban)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>SWIFT</div>
                        <input name={`swift_${i}`} defaultValue={pick(a.swift)} style={inputStyle} />
                      </div>
                    </div>

                    <div className="hint">
                      Ako su sva polja prazna, račun #{i} se neće snimiti.
                    </div>
                  </div>
                );
              })}

              <div className="btnRow">
                <button type="submit" className="btn">Sačuvaj</button>
                <Link href="/dashboard" className="btn">Odustani</Link>
                <span className="muted">
                  Aktivni ID: <span className="mono">{pick(f?.firma_id) || "—"}</span>
                </span>
              </div>

              <div className="hint">
                Snimanjem se pravi novi zapis profila i postaje aktivan. Prethodni aktivni se deaktivira (nema brisanja).
                Bank računi se vezuju za novi aktivni profil.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
