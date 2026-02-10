// src/app/fakture/za-fakturisanje/ui/InvoicePickClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  projekat_id: number;
  narucilac_naziv?: string | null;
  krajnji_klijent_naziv?: string | null;
  radni_naziv?: string | null;
  naziv_za_fakturu?: string | null;
  created_at?: string | null;
  budzet_planirani?: number | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDDMMYYYY(v: any) {
  if (!v) return "—";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return String(v);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmtKM(v: any) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} KM`;
}

export default function InvoicePickClient({ rows }: { rows: Row[] }) {
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const pickedIds = useMemo(
    () => Object.entries(picked).filter(([, on]) => !!on).map(([id]) => Number(id)),
    [picked]
  );

  const allChecked = rows.length > 0 && pickedIds.length === rows.length;

  function toggleAll() {
    if (rows.length === 0) return;
    if (allChecked) {
      setPicked({});
      return;
    }
    const next: Record<number, boolean> = {};
    for (const r of rows) next[Number(r.projekat_id)] = true;
    setPicked(next);
  }

  function toggleOne(id: number) {
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="container">
      <style>{`
        .pageWrap { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        .topBlock {
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
        .topRow { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; }

        .brandWrap { display:flex; align-items:center; gap:12px; }
        .brandLogo { height:30px; width:auto; opacity:.92; }
        .brandTitle { font-size:22px; font-weight:800; line-height:1.1; margin:0; }
        .brandSub { font-size:12px; opacity:.75; margin-top:4px; }

        .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .glassbtn {
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
        .glassbtn:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.26); }
        .glassbtn:active { transform: scale(.985); }
        .glassbtn[aria-disabled="true"] { opacity:.55; pointer-events:none; }

        .divider { height:1px; background: rgba(255,255,255,.12); margin: 12px 0 12px; }

        .listWrap { flex:1; min-height:0; overflow:auto; padding: 14px 0 18px; }
        .tableCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
        }
        .table thead th {
          position: sticky; top:0; z-index:5;
          background: rgba(10,10,10,.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .num { text-align:right; }
        .muted { opacity:.78; font-size:12px; }
        .nowrap { white-space:nowrap; }
      `}</style>

      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img src="/fluxa/logo-light.png" alt="FLUXA" className="brandLogo" />
                <div>
                  <div className="brandTitle">Za fakturisanje</div>
                  <div className="brandSub">Projekti u statusu ZATVOREN (8)</div>
                </div>
              </div>

              <div className="actions">
                <button type="button" className="glassbtn" onClick={toggleAll} title="Označi sve / poništi sve">
                  {allChecked ? "☐ Poništi sve" : "☑ Označi sve"}
                </button>

                {/* ⚠️ Wizard link ćemo povezati kasnije; za sada je samo UI dugme */}
                <Link
                  href="#"
                  className="glassbtn"
                  aria-disabled={pickedIds.length === 0}
                  title={pickedIds.length === 0 ? "Prvo označi projekte" : "Nastavi u wizard"}
                  onClick={(e) => {
                    if (pickedIds.length === 0) e.preventDefault();
                    // kasnije: router.push(`/fakture/wizard?...`)
                  }}
                >
                  ➜ Nastavi ({pickedIds.length})
                </Link>

                <Link href="/projects" className="glassbtn" title="Nazad na projekte">
                  ← Nazad
                </Link>
              </div>
            </div>

            <div className="divider" />

            <div className="muted">
              * Ovdje se ništa ne mijenja u bazi. Samo označavaš projekte koji idu na fakturu.
            </div>
          </div>
        </div>

        <div className="listWrap">
          <div className="tableCard">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 54 }}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th style={{ width: 90 }}>Projekat ID</th>
                  <th>Naručioc</th>
                  <th>Klijent</th>
                  <th>Naziv projekta</th>
                  <th style={{ width: 160 }}>Datum zatvaranja</th>
                  <th className="num" style={{ width: 140 }}>Iznos</th>
                  <th className="num" style={{ width: 150 }}>Sa PDV-om</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ opacity: 0.7, padding: 18 }}>
                      Nema projekata spremnih za fakturisanje.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const id = Number(r.projekat_id);
                    const nar = r.narucilac_naziv ? String(r.narucilac_naziv) : "—";
                    const klj = r.krajnji_klijent_naziv ? String(r.krajnji_klijent_naziv) : "—";
                    const naziv = (r.naziv_za_fakturu || r.radni_naziv || "—").toString();

                    // ⚠️ Privremeno: nemamo još "zatvoren_at" u bazi -> prikazujemo created_at
                    const zatvaranje = fmtDDMMYYYY(r.created_at);

                    const iznos = fmtKM(r.budzet_planirani);

                    // ⚠️ PDV logika dolazi u wizardu (jer zavisi od države/PDV režima klijenta)
                    const pdv = "—";

                    return (
                      <tr key={id}>
                        <td>
                          <input type="checkbox" checked={!!picked[id]} onChange={() => toggleOne(id)} />
                        </td>
                        <td className="nowrap">{id}</td>
                        <td>{nar}</td>
                        <td>{klj}</td>
                        <td className="cell-wrap">
                          <Link href={`/projects/${id}`} className="project-link">
                            {naziv}
                          </Link>
                        </td>
                        <td className="nowrap">{zatvaranje}</td>
                        <td className="num nowrap">{iznos}</td>
                        <td className="num nowrap">{pdv}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ paddingTop: 14, textAlign: "center" }} className="muted">
            made by FLUXA Project &amp; Finance Engine
          </div>
        </div>
      </div>
    </div>
  );
}
