import React from "react";

type Props = {
  hasProject: boolean;
  projectStatusId?: number | null;
  compact?: boolean;
};

const STEPS = [
  { key: "deal", label: "Deal" },
  { key: "prod", label: "Produkcija" },
  { key: "done", label: "Završeno" },
  { key: "closed", label: "Zatvoren" },
  { key: "inv", label: "Fakturisan" },
  { key: "arch", label: "Arhiviran" },
] as const;

function stageIndex(hasProject: boolean, projectStatusId?: number | null) {
  if (!hasProject) return 0; // Deal

  const id = Number(projectStatusId ?? 0);

  // statusi_projekta (tvoj kanon):
  // 4–6 = u produkciji (razne faze)
  // 7 = ZAVRŠENO
  // 8 = ZATVOREN
  // 9 = FAKTURISAN
  // 10 = ARHIVIRAN
  if (id === 10) return 5;
  if (id === 9) return 4;
  if (id === 8) return 3;
  if (id === 7) return 2;
  if (id >= 4 && id <= 6) return 1;

  // fallback: ako je projekat otvoren ali status “čudan”, tretiraj kao Produkcija
  return 1;
}

function stageColorByIndex(idx: number) {
  // diskretno, ali jasno — svaka faza ima svoju boju
  if (idx === 0) return { bg: "rgba(170, 120, 255, .16)", border: "rgba(170, 120, 255, .38)" }; // Deal (ljubičasto)
  if (idx === 1) return { bg: "rgba(55, 214, 122, .14)", border: "rgba(55, 214, 122, .38)" }; // Produkcija (zeleno)
  if (idx === 2) return { bg: "rgba(255, 193, 7, .14)", border: "rgba(255, 193, 7, .38)" }; // Završeno (žuto)
  if (idx === 3) return { bg: "rgba(255, 214, 102, .14)", border: "rgba(255, 214, 102, .40)" }; // Zatvoren (zlatno)
  if (idx === 4) return { bg: "rgba(80, 170, 255, .14)", border: "rgba(80, 170, 255, .40)" }; // Fakturisan (plavo)
  return { bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.18)" }; // Arhiviran (neutral)
}

export default function StatusTimelineBar({ hasProject, projectStatusId, compact }: Props) {
  const cur = stageIndex(hasProject, projectStatusId);
  const curCol = stageColorByIndex(cur);

  const dot = (i: number) => {
    const isPast = i < cur;
    const isCur = i === cur;
    const isFuture = i > cur;

    const bg = isCur
      ? curCol.bg
      : isPast
      ? "rgba(255,255,255,.06)"
      : "rgba(255,255,255,.03)";

    const border = isCur
      ? curCol.border
      : isPast
      ? "rgba(255,255,255,.18)"
      : "rgba(255,255,255,.10)";

    const textOpacity = isCur ? 0.95 : isPast ? 0.55 : 0.35;

    return (
      <div key={STEPS[i].key} style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8, minWidth: 0 }}>
        <span
          style={{
            width: compact ? 10 : 12,
            height: compact ? 10 : 12,
            borderRadius: 999,
            background: isCur ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.22)",
            boxShadow: "0 0 0 3px rgba(255,255,255,.06)",
            border: `1px solid ${border}`,
          }}
          title={STEPS[i].label}
        />
        <span
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: isCur ? 850 : 650,
            opacity: textOpacity,
            whiteSpace: "nowrap",
          }}
        >
          {STEPS[i].label}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: compact ? 8 : 10,
        padding: compact ? "8px 10px" : "10px 12px",
        borderRadius: 14,
        border: `1px solid ${curCol.border}`,
        background: curCol.bg,
        boxShadow: "0 10px 30px rgba(0,0,0,.12)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      title="Deal → Produkcija → Završeno → Zatvoren → Fakturisan → Arhiviran"
    >
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 14, flexWrap: "wrap" }}>
        {STEPS.map((_, i) => (
          <React.Fragment key={STEPS[i].key}>
            {dot(i)}
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                style={{
                  width: compact ? 18 : 26,
                  height: 1,
                  background: i < cur ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.10)",
                  opacity: 1,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
