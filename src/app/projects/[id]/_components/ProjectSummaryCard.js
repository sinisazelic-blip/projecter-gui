// src/app/projects/[id]/_components/ProjectSummaryCard.js
"use client";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

export default function ProjectSummaryCard({ project }) {
  if (!project) return null;

  // ✅ Izračunaj budžet vidljiv radnicima (procenat od punog budžeta)
  const punBudzet = Number(project.budzet_planirani) || 0;
  const procenatZaTim = Number(project.budzet_procenat_za_tim) || 50.00;
  const budzetZaTim = punBudzet * (procenatZaTim / 100);

  // ✅ Izračunaj planiranu zaradu na osnovu budžeta za tim
  const planiranaZaradaZaTim = budzetZaTim - (Number(project.troskovi_ukupno) || 0);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">
            Budžet (KM)
            {procenatZaTim !== 100 && (
              <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>
                ({procenatZaTim.toFixed(0)}%)
              </span>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fmtKM(budzetZaTim)}
          </div>
          {procenatZaTim !== 100 && punBudzet > 0 && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.6,
                marginTop: 2,
                fontStyle: "italic",
              }}
              title={`Puni budžet: ${fmtKM(punBudzet)}`}
            >
              (Puni: {fmtKM(punBudzet)})
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">Troškovi ukupno</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {fmtKM(project.troskovi_ukupno)}
          </div>
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">Planirana zarada</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: planiranaZaradaZaTim < 0 ? "rgba(255, 80, 80, 0.95)" : "inherit",
            }}
          >
            {fmtKM(planiranaZaradaZaTim)}
          </div>
        </div>
      </div>
    </div>
  );
}
