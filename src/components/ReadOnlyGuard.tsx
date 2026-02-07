"use client";

import * as React from "react";

export function ReadOnlyGuard({
  isReadOnly,
  reason = "Projekat je arhiviran (read-only).",
  children,
}: {
  isReadOnly: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  if (!isReadOnly) return <>{children}</>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        className="card"
        style={{
          borderLeft: "6px solid #ef4444",
          background: "rgba(239,68,68,0.08)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🔒 Read-only</div>
        <div style={{ opacity: 0.9 }}>{reason}</div>
      </div>

      {/* disable cijeli blok ispod */}
      <div style={{ opacity: 0.55, pointerEvents: "none" }}>{children}</div>
    </div>
  );
}
