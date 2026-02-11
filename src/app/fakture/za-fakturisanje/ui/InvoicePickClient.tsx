"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  projekat_id: number;
  narucilac_naziv?: string | null;
  narucilac_drzava?: string | null;
  klijent_naziv?: string | null;
  radni_naziv?: string | null;
  closed_at?: string | null;
  budzet_planirani?: number | string | null;
  sa_pdv_km?: number | string | null;
};

type Narucioc = {
  klijent_id: number;
  naziv_klijenta: string;
  drzava?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDDMMYYYY(value: string | null | undefined): string {
  if (!value) return "—";
  const s = String(value).replace(" ", "T");
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmtKM(v: any): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} KM`;
}

export default function InvoicePickClient({
  rows,
  narucioci,
  initial,
}: {
  rows: Row[];
  narucioci: Narucioc[];
  initial: { narucilac_id: string; od: string; do: string };
}) {
  const router = useRouter();

  const [narucilacId, setNarucilacId] = useState<string>(
    initial.narucilac_id || "",
  );
  const [od, setOd] = useState<string>(initial.od || "");
  const [doD, setDoD] = useState<string>(initial.do || "");

  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const pickedIds = useMemo(
    () =>
      Object.entries(picked)
        .filter(([, on]) => !!on)
        .map(([id]) => Number(id)),
    [picked],
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

  function applyFilters() {
    const qs = new URLSearchParams();
    if (narucilacId) qs.set("narucilac_id", narucilacId);
    if (od) qs.set("od", od);
    if (doD) qs.set("do", doD);
    router.push(`/fakture/za-fakturisanje?${qs.toString()}`);
  }

  function goWizard() {
    if (pickedIds.length === 0) return;
    router.push(
      `/fakture/wizard?ids=${encodeURIComponent(pickedIds.join(","))}`,
    );
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
        .brandTitle { font-size:20px; font-weight:800; line-height:1.1; margin:0; }
        .brandSub { font-size:12px; opacity:.75; margin-top:4px; }

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
        .btn[aria-disabled="true"] { opacity:.55; pointer-events:none; }

        .divider { height:1px; background: rgba(255,255,255,.12); margin: 12px 0 12px; }

        .filters{
          display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;
        }
        .field{ display:flex; flex-direction:column; gap:6px; }
        .label{ font-size:12px; opacity:.75; }
        .input{
          min-width: 220px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: inherit;
          outline: none;
        }
        .input.small{ min-width: 160px; }

        .listWrap { flex:1; min-height:0; overflow:auto; padding: 14px 0 18px; }
        .tableCard {
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,.16);
          overflow: hidden;
        }
        table{ width:100%; border-collapse:collapse; }
        thead tr{ background: rgba(255,255,255,.04); }
        th{
          padding: 10px 10px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .25px;
          opacity: .85;
          border-bottom: 1px solid rgba(255,255,255,.10);
          white-space: nowrap;
        }
        td{
          padding: 12px 10px;
          font-size: 13.5px;
          border-top: 1px solid rgba(255,255,255,.08);
          vertical-align: top;
        }
        tbody tr:nth-child(2n){ background: rgba(255,255,255,.02); }
        tbody tr:hover{ background: rgba(255,255,255,.05); }

        .num{ text-align:right; white-space:nowrap; }
        .nowrap{ white-space:nowrap; }
        .muted{ opacity:.78; font-size:12px; }
        .projectLink{ text-decoration:none; }
        .projectLink:hover{ text-decoration: underline; }

        .footer{
          padding-top: 14px;
          text-align:center;
          font-size: 12px;
          opacity: .7;
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
                  <div className="brandTitle">Za fakturisanje</div>
                  <div className="brandSub">
                    Izvještaj-forma · samo projekti ZATVOREN (8)
                  </div>
                </div>
              </div>

              <div className="actions">
                <Link href="/dashboard" className="btn" title="Dashboard">
                  ← Dashboard
                </Link>

                <button
                  type="button"
                  className="btn"
                  onClick={toggleAll}
                  title="Označi sve / poništi sve"
                >
                  {allChecked ? "☐ Poništi sve" : "☑ Označi sve"}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={goWizard}
                  aria-disabled={pickedIds.length === 0}
                  title={
                    pickedIds.length === 0
                      ? "Prvo označi projekte"
                      : "Nastavi u wizard"
                  }
                >
                  ➜ Dalje ({pickedIds.length})
                </button>

                <Link href="/projects" className="btn" title="Odustani">
                  ✖ Odustani
                </Link>
              </div>
            </div>

            <div className="divider" />

            <div className="filters">
              <div className="field">
                <div className="label">Naručilac</div>
                <select
                  className="input"
                  value={narucilacId}
                  onChange={(e) => setNarucilacId(e.target.value)}
                >
                  <option value="">— svi —</option>
                  {narucioci.map((k) => (
                    <option key={k.klijent_id} value={String(k.klijent_id)}>
                      {k.naziv_klijenta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="label">Od datuma</div>
                <input
                  className="input small"
                  type="date"
                  value={od}
                  onChange={(e) => setOd(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="label">Do datuma</div>
                <input
                  className="input small"
                  type="date"
                  value={doD}
                  onChange={(e) => setDoD(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn"
                onClick={applyFilters}
                title="Primijeni filtere (GET)"
              >
                🔎 Primijeni
              </button>

              <div className="muted">
                * Filteri su GET. Checkbox selekcija je lokalna (ne dira bazu).
              </div>
            </div>
          </div>
        </div>

        <div className="listWrap">
          <div className="tableCard">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 54 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={{ width: 90 }}>Projekat ID</th>
                  <th style={{ width: 240 }}>Naručilac</th>
                  <th style={{ width: 240 }}>Klijent</th>
                  <th>Naziv projekta</th>
                  <th style={{ width: 160 }}>Datum zatvaranja</th>
                  <th className="num" style={{ width: 140 }}>
                    Iznos (KM)
                  </th>
                  <th className="num" style={{ width: 160 }}>
                    Sa PDV-om
                  </th>
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
                    const nar = r.narucilac_naziv
                      ? String(r.narucilac_naziv)
                      : "—";

                    // Klijent prikazujemo samo ako postoji i različit je od naručioca (LOCK)
                    const kl = r.klijent_naziv ? String(r.klijent_naziv) : "";
                    const klijentCell = kl && kl !== nar ? kl : "—";

                    return (
                      <tr key={id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!picked[id]}
                            onChange={() => toggleOne(id)}
                          />
                        </td>
                        <td className="nowrap">{id}</td>
                        <td>{nar}</td>
                        <td>{klijentCell}</td>
                        <td>
                          <Link
                            className="projectLink"
                            href={`/projects/${id}`}
                            title="Otvori projekat u novoj ruti"
                          >
                            {r.radni_naziv ?? "—"}
                          </Link>
                        </td>
                        <td className="nowrap">
                          {fmtDDMMYYYY(r.closed_at ?? null)}
                        </td>
                        <td className="num nowrap">
                          {fmtKM(r.budzet_planirani)}
                        </td>
                        <td className="num nowrap">
                          {r.sa_pdv_km === null || r.sa_pdv_km === undefined
                            ? "—"
                            : fmtKM(r.sa_pdv_km)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="footer">
            made by FLUXA Project &amp; Finance Engine
          </div>
        </div>
      </div>
    </div>
  );
}
