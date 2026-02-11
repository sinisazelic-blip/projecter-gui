"use client";

import Link from "next/link";
import { useMemo, useState, useRef } from "react";
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

// Helper funkcije za konverziju između ISO (YYYY-MM-DD) i dd.mm.yyyy formata
const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
const isDDMMYYYY = (s: string) => /^\d{2}\.\d{2}\.\d{4}$/.test(String(s || "").trim());

const isoToDDMMYYYY = (iso: string): string | null => {
  if (!isISODate(iso)) return null;
  const [y, m, d] = String(iso).split("-");
  return `${d}.${m}.${y}`;
};

const ddmmyyyyToISO = (ddmmyyyy: string): string | null => {
  const s = String(ddmmyyyy || "").trim();
  if (!isDDMMYYYY(s)) return null;
  const [dd, mm, yyyy] = s.split(".");
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y))
    return null;
  if (y < 1900 || y > 2200) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  // real-date check
  const test = new Date(y, m - 1, d);
  if (Number.isNaN(test.getTime())) return null;
  if (
    test.getFullYear() !== y ||
    test.getMonth() !== m - 1 ||
    test.getDate() !== d
  )
    return null;

  return `${yyyy}-${mm}-${dd}`;
};

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
  
  // Konvertujemo initial ISO format u dd.mm.yyyy za UI
  const initialOdDDMM = initial.od && isISODate(initial.od) 
    ? (isoToDDMMYYYY(initial.od) || "") 
    : (initial.od || "");
  const initialDoDDMM = initial.do && isISODate(initial.do)
    ? (isoToDDMMYYYY(initial.do) || "")
    : (initial.do || "");
  
  const [od, setOd] = useState<string>(initialOdDDMM);
  const [doD, setDoD] = useState<string>(initialDoDDMM);
  
  // Skriveni date input refs za date picker
  const odDateRef = useRef<HTMLInputElement>(null);
  const doDateRef = useRef<HTMLInputElement>(null);
  
  // Konvertujemo dd.mm.yyyy u ISO format za date input value
  const odISO = useMemo(() => ddmmyyyyToISO(od) || "", [od]);
  const doISO = useMemo(() => ddmmyyyyToISO(doD) || "", [doD]);

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
    // Konvertujemo dd.mm.yyyy u ISO format za URL
    const odISO = ddmmyyyyToISO(od);
    const doISO = ddmmyyyyToISO(doD);
    if (odISO) qs.set("od", odISO);
    if (doISO) qs.set("do", doISO);
    router.push(`/fakture/za-fakturisanje?${qs.toString()}`);
  }
  
  function openDatePicker(ref: React.RefObject<HTMLInputElement>) {
    const el = ref.current;
    if (!el) return;
    // Chrome/Edge support
    // @ts-expect-error showPicker exists in Chromium
    if (typeof el.showPicker === "function") {
      // @ts-expect-error
      el.showPicker();
      return;
    }
    // fallback
    el.focus();
    el.click();
  }

  function goWizard() {
    if (pickedIds.length === 0) return;
    router.push(
      `/fakture/wizard?ids=${encodeURIComponent(pickedIds.join(","))}`,
    );
  }

  return (
    <div className="container">
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
                <Link href="/dashboard" className="btn" title="Povratak na Dashboard">
                  🏠 Dashboard
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
                <div style={{ position: "relative" }}>
                  <input
                    className="input small"
                    type="text"
                    inputMode="numeric"
                    value={od}
                    onChange={(e) => setOd(e.target.value)}
                    placeholder="dd.mm.yyyy"
                    style={{ paddingRight: 44 }}
                  />
                  <div
                    title="Izaberi datum"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "rgba(255,255,255,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                      cursor: "pointer",
                    }}
                  >
                    📅
                  </div>
                  <input
                    ref={odDateRef}
                    type="date"
                    value={odISO}
                    onChange={(e) => {
                      const iso = e.target.value;
                      const human = isoToDDMMYYYY(iso);
                      if (human) setOd(human);
                    }}
                    aria-label="Izaberi datum"
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      opacity: 0,
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                    }}
                    onClick={() => openDatePicker(odDateRef)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">Do datuma</div>
                <div style={{ position: "relative" }}>
                  <input
                    className="input small"
                    type="text"
                    inputMode="numeric"
                    value={doD}
                    onChange={(e) => setDoD(e.target.value)}
                    placeholder="dd.mm.yyyy"
                    style={{ paddingRight: 44 }}
                  />
                  <div
                    title="Izaberi datum"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "rgba(255,255,255,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                      cursor: "pointer",
                    }}
                  >
                    📅
                  </div>
                  <input
                    ref={doDateRef}
                    type="date"
                    value={doISO}
                    onChange={(e) => {
                      const iso = e.target.value;
                      const human = isoToDDMMYYYY(iso);
                      if (human) setDoD(human);
                    }}
                    aria-label="Izaberi datum"
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      opacity: 0,
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                    }}
                    onClick={() => openDatePicker(doDateRef)}
                  />
                </div>
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
