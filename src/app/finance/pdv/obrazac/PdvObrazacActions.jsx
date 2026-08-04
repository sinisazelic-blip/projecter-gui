"use client";

export default function PdvObrazacActions({ backHref }) {
  return (
    <div className="pdvObrazacToolbar no-print">
      <a href={backHref} className="btn">
        ← Nazad na PDV
      </a>
      <button type="button" className="btn btn--active" onClick={() => window.print()}>
        Štampaj
      </button>
    </div>
  );
}
