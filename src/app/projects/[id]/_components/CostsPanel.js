"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CostTypeAndEntityPicker from "./CostTypeAndEntityPicker";
import CostRow from "./CostRow";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

const CURRENCIES = ["BAM", "EUR", "USD", "RSD"];
const STATUS_OPTIONS = ["PLANIRANO", "NASTALO", "PLACENO"];

// ✅ samo kozmetika prikaza (ne dira DB)
const prettyTipName = (tipId, fallback) => {
  const id = Number(tipId);
  if (id === 1) return "Honorar";
  if (id === 2) return "Usluge";
  if (id === 3) return "Firma";
  if (id === 4) return "Ostalo";
  return fallback ?? (Number.isFinite(id) ? `Tip ${id}` : "Tip");
};

// ✅ pravilo za UI (da ne vuče pogrešan entitet kad ne treba)
const tipNeedsEntity = (tipId) => {
  const id = Number(tipId);
  // Honorar -> talent, Firma -> vendor; ostalo/usluge -> ništa
  if (id === 1) return "talent";
  if (id === 3) return "vendor";
  return "none";
};

// --------------------
// DATUM helpers (dd.mm.yyyy ↔ YYYY-MM-DD)
// --------------------
const pad2 = (n) => String(n).padStart(2, "0");

const todayDDMMYYYY = () => {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
const isDDMMYYYY = (s) => /^\d{2}\.\d{2}\.\d{4}$/.test(String(s || "").trim());

const isoToDDMMYYYY = (iso) => {
  if (!isISODate(iso)) return null;
  const [y, m, d] = String(iso).split("-");
  return `${d}.${m}.${y}`;
};

const ddmmyyyyToISO = (ddmmyyyy) => {
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

  // real-date check (31.02.)
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

export default function CostsPanel({
  project,
  costs,
  showStornirano,
  actions,
  returnTo,
}) {
  const router = useRouter();

  const formRef = useRef(null);
  const opisRef = useRef(null);

  const pid = project?.projekat_id ?? "";
  const safeReturnTo = returnTo || `/projects/${pid}`;

  // ADD COST STATE (auto kurs)
  const [valuta, setValuta] = useState("BAM");

  // ✅ UI datum (dd.mm.yyyy) — po Fluxa standardu
  const [datumUI, setDatumUI] = useState(() => todayDDMMYYYY());

  // ✅ hidden/tech datum (YYYY-MM-DD) za server & /api/fx
  const datumISO = useMemo(() => ddmmyyyyToISO(datumUI), [datumUI]);

  const [iznos, setIznos] = useState("");
  const [kurs, setKurs] = useState(1);
  const [kursSource, setKursSource] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // pamćenje zadnjih izbora
  const [tipId, setTipId] = useState("1");
  const [statusAdd, setStatusAdd] = useState("NASTALO");

  // povezani entitet (talent/vendor)
  const [entity, setEntity] = useState({
    tip_id: 1,
    entity_type: null,
    entity_id: null,
  });

  // učitaj last choices
  useEffect(() => {
    try {
      const pidLocal = project.projekat_id;

      const savedC = localStorage.getItem(`lastCurrency:${pidLocal}`);
      if (savedC) setValuta(savedC);

      const savedD = localStorage.getItem(`lastDate:${pidLocal}`);
      if (savedD) {
        // podrži i stari format (YYYY-MM-DD) i novi (dd.mm.yyyy)
        if (isDDMMYYYY(savedD)) {
          setDatumUI(savedD);
        } else if (isISODate(savedD)) {
          const conv = isoToDDMMYYYY(savedD);
          if (conv) setDatumUI(conv);
        }
      }

      const savedT = localStorage.getItem(`lastTip:${pidLocal}`);
      if (savedT) setTipId(savedT);

      const savedS = localStorage.getItem(`lastStatus:${pidLocal}`);
      if (savedS && STATUS_OPTIONS.includes(savedS)) setStatusAdd(savedS);
    } catch {}

    setTimeout(() => {
      opisRef.current?.focus();
    }, 50);
  }, [project.projekat_id]);

  // sync tipId -> entity.tip_id + očisti entity ako ne treba
  useEffect(() => {
    const n = Number(tipId);
    const req = tipNeedsEntity(n);

    setEntity((prev) => {
      const next = { ...prev, tip_id: Number.isFinite(n) ? n : null };

      // ako tip ne traži entitet, očisti
      if (req === "none") {
        next.entity_type = null;
        next.entity_id = null;
        return next;
      }

      // ako tip traži talent/vendor, ali trenutno je druga vrsta -> očisti
      if (next.entity_type && next.entity_type !== req) {
        next.entity_type = null;
        next.entity_id = null;
      }

      return next;
    });
  }, [tipId]);

  // save last choices
  useEffect(() => {
    try {
      localStorage.setItem(`lastCurrency:${project.projekat_id}`, valuta);
    } catch {}
  }, [project.projekat_id, valuta]);

  useEffect(() => {
    try {
      // čuvamo ono što prikazujemo (dd.mm.yyyy)
      localStorage.setItem(`lastDate:${project.projekat_id}`, datumUI);
    } catch {}
  }, [project.projekat_id, datumUI]);

  useEffect(() => {
    try {
      localStorage.setItem(`lastTip:${project.projekat_id}`, tipId);
    } catch {}
  }, [project.projekat_id, tipId]);

  useEffect(() => {
    try {
      localStorage.setItem(`lastStatus:${project.projekat_id}`, statusAdd);
    } catch {}
  }, [project.projekat_id, statusAdd]);

  const previewKM = useMemo(() => {
    const a = Number.parseFloat(String(iznos).replace(",", "."));
    const r = Number.parseFloat(String(kurs).replace(",", "."));
    if (!Number.isFinite(a) || !Number.isFinite(r)) return NaN;
    return a * r;
  }, [iznos, kurs]);

  // fetch kurs
  useEffect(() => {
    // nema validnog ISO datuma -> ne možemo fetchati
    if (!datumISO || valuta === "BAM") {
      setKurs(1);
      setKursSource("fixed");
      return;
    }

    let cancelled = false;
    setLoadingRate(true);

    fetch(`/api/fx?date=${datumISO}&ccy=${valuta}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setKurs(data.rate_to_bam);
          setKursSource(data.source || "auto");
        } else {
          setKurs("");
          setKursSource("manual");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKurs("");
          setKursSource("manual");
        }
      })
      .finally(() => !cancelled && setLoadingRate(false));

    return () => {
      cancelled = true;
    };
  }, [datumISO, valuta]);

  const onIznosKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit?.();
    }
  };

  const resetAddForm = () => {
    setIznos("");
    setEntity((prev) => ({ ...prev, entity_type: null, entity_id: null }));
    setTimeout(() => {
      opisRef.current?.focus();
    }, 30);
  };

  const onAddSubmit = () => {
    resetAddForm();
  };

  // ✅ ESC behavior (Varijanta 3):
  // - ako je forma "aktivna" (fokus u inputu ili ima unosa) -> reset
  // - ako je forma mirna/prazna -> router.back()
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      const formEl = formRef.current;
      const active = document.activeElement;

      const focusInForm =
        formEl && active && active instanceof HTMLElement
          ? formEl.contains(active)
          : false;

      const hasWork =
        focusInForm ||
        String(iznos || "").trim() !== "" ||
        String(entity?.entity_type || "").trim() !== "" ||
        String(entity?.entity_id || "").trim() !== "";

      if (hasWork) {
        e.preventDefault();
        resetAddForm();
        return;
      }

      e.preventDefault();
      router.back();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, iznos, entity?.entity_type, entity?.entity_id]);

  return (
    <>
      <h2 style={{ fontSize: 18, marginTop: 18, marginBottom: 10 }}>
        Dodaj trošak
      </h2>

      <form
        ref={formRef}
        action={actions.addCost}
        className="card"
        style={{ padding: 14 }}
        onSubmit={onAddSubmit}
      >
        <input type="hidden" name="projekat_id" value={project.projekat_id} />

        {/* ✅ vrati me na isti URL (npr. ?stornirano=1) */}
        <input type="hidden" name="return_to" value={safeReturnTo} />

        {/* ✅ tip_id mora ići na server */}
        <input type="hidden" name="tip_id" value={tipId} />

        <input
          type="hidden"
          name="entity_type"
          value={entity.entity_type ?? ""}
        />
        <input type="hidden" name="entity_id" value={entity.entity_id ?? ""} />

        {/* ✅ datum šaljemo serveru kao ISO (YYYY-MM-DD) */}
        <input type="hidden" name="datum_troska" value={datumISO ?? ""} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr 1.6fr 0.8fr 0.9fr 1fr",
            gap: 8,
            alignItems: "start",
          }}
        >
          <div style={{ gridColumn: "1 / span 1", minWidth: 260 }}>
            <CostTypeAndEntityPicker
              value={{
                tip_id: Number(tipId) || null,
                entity_type: entity.entity_type,
                entity_id: entity.entity_id,
              }}
              // ✅ samo kozmetika labela tipova
              tipLabel={(t) => prettyTipName(t?.tip_id, t?.naziv)}
              onChange={(v) => {
                const nextTip = v?.tip_id ? String(v.tip_id) : "";
                if (nextTip && nextTip !== tipId) setTipId(nextTip);

                setEntity({
                  tip_id: v?.tip_id ?? (Number(tipId) || null),
                  entity_type: v?.entity_type ?? null,
                  entity_id: v?.entity_id ?? null,
                });
              }}
            />
          </div>

          {/* ✅ dd.mm.yyyy input + "sigurni" native picker preko ikonice */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="numeric"
              name="datum_ui"
              value={datumUI}
              onChange={(e) => setDatumUI(e.target.value)}
              placeholder="dd.mm.yyyy"
              required
              style={{ ...inputStyle, paddingRight: 44 }}
              title="Datum (dd.mm.yyyy)"
            />

            {/* ikonica (samo vizuelno) */}
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
                pointerEvents: "none", // klik ide na input ispod
              }}
            >
              📅
            </div>

            {/* ✅ stvarni klikabilni date input - nevidljiv, ali NA IKONICI */}
            <input
              type="date"
              value={datumISO ?? ""}
              onChange={(e) => {
                const iso = e.target.value; // YYYY-MM-DD
                const human = isoToDDMMYYYY(iso);
                if (human) setDatumUI(human);
              }}
              aria-label="Izaberi datum"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 34,
                height: 34,
                opacity: 0, // ne vidi se
                cursor: "pointer",
                border: "none",
                background: "transparent",
              }}
            />
          </div>

          <input
            ref={opisRef}
            type="text"
            name="opis"
            placeholder="Opis troška"
            required
            style={inputStyle}
          />

          <select
            name="valuta"
            value={valuta}
            onChange={(e) => setValuta(e.target.value)}
            style={inputStyle}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.01"
            name="iznos_km"
            placeholder={`Iznos (${valuta})`}
            value={iznos}
            onChange={(e) => setIznos(e.target.value)}
            onKeyDown={onIznosKeyDown}
            required
            style={inputStyle}
          />

          <input
            type="number"
            step="0.000001"
            name="kurs"
            value={valuta === "BAM" ? 1 : kurs}
            onChange={(e) => setKurs(e.target.value)}
            readOnly={valuta === "BAM"}
            placeholder="Kurs (BAM)"
            style={{ ...inputStyle, opacity: valuta === "BAM" ? 0.75 : 1 }}
          />

          <select
            name="status"
            value={statusAdd}
            onChange={(e) => setStatusAdd(e.target.value)}
            style={inputStyle}
            title="Status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ poruka ako datum nije validan */}
        {!datumISO && (
          <div style={{ marginTop: 8, fontSize: 12, color: "crimson" }}>
            Neispravan datum. Format mora biti <strong>dd.mm.yyyy</strong>.
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 14,
            opacity: 0.85,
          }}
        >
          <span>
            ≈{" "}
            <strong>
              {Number.isFinite(previewKM) ? fmtKM(previewKM) : "—"}
            </strong>
          </span>
          {loadingRate && valuta !== "BAM" && (
            <span className="muted">Učitavam kurs…</span>
          )}
          {kursSource === "manual" && valuta !== "BAM" && (
            <span className="muted">Kurs ručni</span>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <button type="submit" disabled={!datumISO}>
            Dodaj trošak
          </button>
        </div>
      </form>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 18, marginTop: 18, marginBottom: 10 }}>
          Troškovi (zadnjih 200)
        </h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted">Stornirani:</span>
          {showStornirano
            ? <Link
                href={`/projects/${project.projekat_id}`}
                className="project-link"
              >
                sakrij
              </Link>
            : <Link
                href={`/projects/${project.projekat_id}?stornirano=1`}
                className="project-link"
              >
                prikaži
              </Link>}
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Opis</th>
            <th className="num">Iznos</th>
            <th>Status</th>
            <th>Akcije</th>
          </tr>
        </thead>

        <tbody>
          {costs.length === 0
            ? <tr>
                <td colSpan={5} className="muted">
                  Nema troškova za prikaz.
                </td>
              </tr>
            : costs.map((c) => (
                <CostRow
                  key={c.trosak_id}
                  c={c}
                  project={project}
                  actions={actions}
                  returnTo={safeReturnTo}
                />
              ))}
        </tbody>
      </table>
    </>
  );
}
