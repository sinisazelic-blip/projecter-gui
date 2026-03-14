"use client";

/**
 * Suptilan "DEMO" badge u topblocku – prikazuje se samo na demo.studiotaf.xyz
 */
export default function DemoBadge({ show }) {
  if (!show) return null;
  return (
    <span
      style={{
        position: "fixed",
        top: 18,
        right: 20,
        zIndex: 50,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        padding: "4px 10px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
      }}
    >
      Demo
    </span>
  );
}
