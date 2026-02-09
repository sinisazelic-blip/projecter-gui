// src/app/narudzbenice/page.js
import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? "0" + s : s;
}
function fmtDateDDMMYYYY(d) {
  if (!d) return "";
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}
function fmtAmount(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}
function buildQuery(paramsObj) {
  const parts = [];
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (!s) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function Page({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const clientRaw = String(sp?.klijent_id ?? "").trim();
  const klijentId = clientRaw ? Number(clientRaw) : null;

  const clients = await query(
    `
    SELECT klijent_id, naziv_klijenta
    FROM klijenti
    WHERE aktivan = 1
    ORDER BY naziv_klijenta ASC
    `
  );

  // ✅ supplier_id: radi i kad je pt.dobavljac_id NULL ali entity_type/entity_id nosi dobavljača
  // U tvojoj bazi: entity_type za dobavljače je 'vendor' (vidjeli smo).
  // Podržimo i 'dobavljac' i 'supplier' za robustnost.
  const rows = await query(
    `
    SELECT
      d.dobavljac_id,
      d.naziv AS dobavljac_naziv,
      d.drzava_iso2,
      d.email,
      p.narucilac_id AS klijent_id,
      k.naziv_klijenta AS klijent_naziv,
      pt.valuta_original AS valuta,
      SUM(pt.iznos_original) AS ukupno,
      GROUP_CONCAT(DISTINCT p.projekat_id ORDER BY p.projekat_id SEPARATOR ',') AS projekti_ids,
      GROUP_CONCAT(DISTINCT CONCAT('PO-', p.projekat_id) ORDER BY p.projekat_id SEPARATOR ', ') AS po_list
    FROM projektni_troskovi pt
    JOIN projekti p ON p.projekat_id = pt.projekat_id
    JOIN klijenti k ON k.klijent_id = p.narucilac_id

    JOIN dobavljaci d ON d.dobavljac_id = COALESCE(
      pt.dobavljac_id,
      IF(pt.entity_type IN ('vendor','dobavljac','supplier'), pt.entity_id, NULL)
    )

    WHERE p.status_id = 8
      AND COALESCE(pt.dobavljac_id, IF(pt.entity_type IN ('vendor','dobavljac','supplier'), pt.entity_id, NULL)) IS NOT NULL
      AND pt.status <> 'STORNIRANO'
      AND pt.status <> 'PLACENO'
      ${klijentId ? "AND p.narucilac_id = ?" : ""}

    GROUP BY
      d.dobavljac_id, d.naziv, d.drzava_iso2, d.email,
      p.narucilac_id, k.naziv_klijenta,
      pt.valuta_original

    ORDER BY k.naziv_klijenta ASC, d.naziv ASC, pt.valuta_original ASC
    `,
    klijentId ? [klijentId] : []
  );

  // group: Klijent × Dobavljač
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.klijent_id}::${r.dobavljac_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        klijent_id: r.klijent_id,
        klijent_naziv: r.klijent_naziv,
        dobavljac_id: r.dobavljac_id,
        dobavljac_naziv: r.dobavljac_naziv,
        drzava_iso2: r.drzava_iso2 || "—",
        email: r.email || "",
        projekti_ids: r.projekti_ids || "",
        po_list: r.po_list || "",
        values: [],
      });
    }
    const g = groups.get(key);
    g.values.push({ valuta: r.valuta, ukupno: r.ukupno });
    g.projekti_ids = r.projekti_ids || g.projekti_ids;
    g.po_list = r.po_list || g.po_list;
  }

  const list = Array.from(groups.values());
  const today = fmtDateDDMMYYYY(new Date());

  const inputStyle = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    color: "inherit",
    outline: "none",
  };

  const qsReset = buildQuery({});

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
        .topBlock {
          position: sticky; top: 0; z-index: 30;
          padding: 14px 0 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .topInner { padding: 0 14px; }
        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height: 30px; width:auto; opacity:.92; }
        .brandTitle { font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0; }
        .brandSub { font-size: 12px; opacity: .75; margin-top: 4px; }
        .topRow { display:flex; justify-content: space-between; gap:12px; align-items:center; flex-wrap:wrap; }
        .divider { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0 12px; }
        .listWrap { flex:1; min-height:0; overflow:auto; padding: 14px 0 18px; }
        .tableCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
        }
        .table thead th {
          position: sticky; top: 0; z-index: 5;
          background: rgba(10,10,10,.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
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
        .valStack { display:flex; flex-direction:column; gap:6px; }
        .valLine { display:flex; gap:8px; align-items:baseline; white-space:nowrap; }
        .valAmt { font-weight: 850; }
        .valCur { opacity:.75; font-size:12px; }
        .muted { opacity:.75; }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Narudžbenice</div>
                  <div className="brandSub">Zatvoreni projekti (status 8) · email-only · {today}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <Link href="/dashboard" className="btn">Dashboard</Link>
                <Link href="/projects" className="btn">Projekti</Link>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <form method="GET" style={{ width: "100%" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    <span className="muted">Klijent (naručilac):</span>
                    <select name="klijent_id" defaultValue={klijentId ? String(klijentId) : ""} style={inputStyle}>
                      <option value="">Svi</option>
                      {clients.map((c) => (
                        <option key={c.klijent_id} value={String(c.klijent_id)}>{c.naziv_klijenta}</option>
                      ))}
                    </select>

                    <button type="submit" className="btn" style={{ minWidth: 110 }}>Filtriraj</button>
                    <Link href={`/narudzbenice${qsReset}`} className="btn" style={{ padding:"10px 12px", minWidth:90, textAlign:"center" }}>Reset</Link>
                  </div>

                  <div className="pill">
                    <span style={{ opacity: 0.85 }}>Grupisanje:</span>
                    <b>Klijent × Dobavljač</b>
                  </div>
                </div>
              </form>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="listWrap">
          <div className="tableCard">
            <table className="table">
              <thead>
                <tr>
                  <th>Klijent</th>
                  <th>Dobavljač</th>
                  <th>Država</th>
                  <th>Vrijednost</th>
                  <th>PO brojevi</th>
                  <th style={{ width: 160 }}>Akcija</th>
                </tr>
              </thead>
              <tbody>
                {list.map((g) => {
                  const previewQs = buildQuery({ klijent_id: String(g.klijent_id), dobavljac_id: String(g.dobavljac_id) });
                  return (
                    <tr key={`${g.klijent_id}-${g.dobavljac_id}`}>
                      <td className="cell-wrap">
                        <div style={{ fontWeight: 800 }}>{g.klijent_naziv}</div>
                        <div className="muted" style={{ fontSize: 12 }}>ID: {g.klijent_id}</div>
                      </td>

                      <td className="cell-wrap">
                        <div style={{ fontWeight: 800 }}>{g.dobavljac_naziv}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          ID: {g.dobavljac_id}{g.email ? ` · ${g.email}` : ""}
                        </div>
                      </td>

                      <td>{g.drzava_iso2}</td>

                      <td>
                        <div className="valStack">
                          {g.values.map((v) => (
                            <div className="valLine" key={`${v.valuta}`}>
                              <span className="valAmt">{fmtAmount(v.ukupno)}</span>
                              <span className="valCur">{v.valuta}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="cell-wrap">
                        <span className="muted" style={{ fontSize: 12 }}>{g.po_list || "—"}</span>
                      </td>

                      <td>
                        <Link className="btn" href={`/narudzbenice/preview${previewQs}`}>Preview</Link>
                      </td>
                    </tr>
                  );
                })}

                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ opacity: 0.7, padding: 18 }}>
                      Nema narudžbenica za zadati filter. (Dobavljač trošak mora biti u projektni_troskovi:
                      dobavljac_id ili entity_type='vendor' + entity_id.)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
            Savjet: izaberi klijenta ako želiš objedinjenu narudžbenicu za više projekata tog naručioca.
          </div>
        </div>
      </div>
    </div>
  );
}
