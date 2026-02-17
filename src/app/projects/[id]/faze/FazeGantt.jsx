"use client";

import { useMemo } from "react";

function fmtShortDate(d) {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return day && m ? `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]}` : s;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10));
  return isNaN(d.getTime()) ? null : d;
}

function toTs(d) {
  return d ? d.getTime() : 0;
}

/**
 * Timeline Gantt – čist CSS, bez spoljnih biblioteka.
 * Prikazuje faze sa datum_pocetka i datum_kraja.
 */
export default function FazeGantt({ faze }) {
  const { phases, minTs, maxTs, rangeMs } = useMemo(() => {
    if (!Array.isArray(faze)) return { phases: [], minTs: 0, maxTs: 0, rangeMs: 1 };
    const valid = faze.filter((f) => {
      const start = f.datum_pocetka ? String(f.datum_pocetka).slice(0, 10) : null;
      const end = f.datum_kraja ? String(f.datum_kraja).slice(0, 10) : f.deadline ? String(f.deadline).slice(0, 10) : null;
      return start && end;
    });
    if (valid.length === 0) return { phases: [], minTs: 0, maxTs: 0, rangeMs: 1 };
    let minTs = Infinity;
    let maxTs = -Infinity;
    const phases = valid.map((f) => {
      const start = parseDate(f.datum_pocetka);
      const end = parseDate(f.datum_kraja || f.deadline);
      const s = toTs(start);
      const e = toTs(end);
      if (s < minTs) minTs = s;
      if (e > maxTs) maxTs = e;
      const radniciStr = f.radnici?.length ? f.radnici.map((r) => `${r.ime} ${r.prezime}`).join(", ") : "";
      const name = [f.faza_naziv || f.naziv || "—", radniciStr].filter(Boolean).join(" • ");
      return {
        id: f.projekat_faza_id,
        name: name.length > 50 ? name.slice(0, 47) + "…" : name,
        startTs: s,
        endTs: e,
        progress: Math.min(100, Math.max(0, Number(f.procenat_izvrsenosti) || 0)),
      };
    });
    const rangeMs = Math.max(maxTs - minTs, 1);
    return { phases, minTs, maxTs, rangeMs };
  }, [faze]);

  if (phases.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
        Nema faza sa datumima za timeline. Unesi datum početka i kraja u fazama.
      </div>
    );
  }

  const toPct = (ts) => ((ts - minTs) / rangeMs) * 100;
  const monthLabels = [];
  const step = rangeMs / 8;
  for (let i = 0; i <= 8; i++) {
    const ts = minTs + (rangeMs * i) / 8;
    monthLabels.push({ ts, label: fmtShortDate(new Date(ts).toISOString().slice(0, 10)) });
  }

  return (
    <div className="ganttTimeline">
      <div className="ganttScale">
        {monthLabels.map((m, i) => (
          <div key={i} className="ganttScaleTick" style={{ left: `${(i / 8) * 100}%` }}>
            {m.label}
          </div>
        ))}
      </div>
      <div className="ganttRows">
        {phases.map((p) => {
          const leftPct = toPct(p.startTs);
          const widthPct = ((p.endTs - p.startTs) / rangeMs) * 100;
          return (
            <div key={p.id} className="ganttRow">
              <div className="ganttLabel" title={p.name}>
                {p.name}
              </div>
              <div className="ganttBarTrack">
                <div
                  className="ganttBar"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 2)}%`,
                  }}
                >
                  <div
                    className="ganttBarProgress"
                    style={{ width: `${p.progress}%` }}
                    title={`${p.progress}% izvršeno`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
