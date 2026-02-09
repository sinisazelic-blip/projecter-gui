// src/lib/ui/fluxaTimeline.js

/**
 * FLUXA KANON — Timeline faza (read-only indikator)
 * Deal → Produkcija → Završeno → Zatvoren → Fakturisan → Arhiviran
 *
 * phase index:
 * 0 Deal
 * 1 Produkcija (project opened / active)
 * 2 Završeno
 * 3 Zatvoren
 * 4 Fakturisan
 * 5 Arhiviran
 */

export const FLUXA_PHASES = ["Deal", "Produkcija", "Završeno", "Zatvoren", "Fakturisan", "Arhiviran"];

/**
 * Mapiranje kanonskih status_id (projekti) → phase index.
 * - 7 Završen  => 2
 * - 8 Zatvoren => 3
 * - 9 Fakturisan => 4
 * - 10 Arhiviran => 5
 * - ostalo (1–6,11...) => 1 (Produkcija)
 */
export function phaseFromProjectStatusId(statusId) {
  const id = Number(statusId ?? 0);
  if (id === 7) return 2;
  if (id === 8) return 3;
  if (id === 9) return 4;
  if (id === 10) return 5;
  if (id > 0) return 1;
  return 0; // fallback
}

/**
 * Deal nema status projekta dok projekat ne postoji.
 * - ako nema projekta: 0 (Deal)
 * - ako ima projekta: mapiramo po status_id projekta (1..)
 */
export function phaseForDeal({ hasProject, projectStatusId }) {
  if (!hasProject) return 0;
  return phaseFromProjectStatusId(projectStatusId);
}

export function FluxaTimeline({ phase = 0, title = "Faza" }) {
  const p = Math.max(0, Math.min(5, Number(phase) || 0));

  // fluxa green (iz vašeg “signal” tona)
  const ACTIVE = "rgba(80, 220, 140, .95)";
  const PAST = "rgba(255,255,255,.55)";
  const FUTURE = "rgba(255,255,255,.35)";
  const SEP = "rgba(255,255,255,.28)";

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
        boxShadow: "0 10px 26px rgba(0,0,0,.14)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
      aria-label="Fluxa timeline faza"
      title={title}
    >
      <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 800, letterSpacing: 0.2 }}>{title}</span>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {FLUXA_PHASES.map((label, idx) => {
          const isActive = idx === p;
          const isPast = idx < p;

          return (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontWeight: isActive ? 900 : 750,
                  color: isActive ? ACTIVE : isPast ? PAST : FUTURE,
                  letterSpacing: 0.2,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>

              {idx < FLUXA_PHASES.length - 1 ? (
                <span style={{ color: SEP, opacity: 0.9, fontWeight: 900 }} aria-hidden="true">
                  →
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
