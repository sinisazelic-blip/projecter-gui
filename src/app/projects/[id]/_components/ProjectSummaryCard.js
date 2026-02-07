// src/app/projects/[id]/_components/ProjectSummaryCard.js
"use client";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

export default function ProjectSummaryCard({ project }) {
  if (!project) return null;

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">Budžet (KM)</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fmtKM(project.budzet_planirani)}
          </div>
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">Troškovi ukupno</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fmtKM(project.troskovi_ukupno)}
          </div>
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">Planirana zarada</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fmtKM(project.planirana_zarada)}
          </div>
        </div>
      </div>
    </div>
  );
}
