"use client";

import { useState } from "react";

const USER_LABEL = "SiNY"; // ← promijeni u "Sinisa" ako želiš

export function CloseProjectModal({
  projekatId,
  onDone,
  onCancel,
}: {
  projekatId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function closeProject(force = false) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projekatId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": USER_LABEL, // ✅ OVO je bitno
        },
        body: JSON.stringify(force ? { force: true } : {}),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json?.error === "CLOSE_NEEDS_CONFIRM") {
          setNeedsConfirm(true);
          return;
        }
        throw new Error(json?.error || "Greška pri zatvaranju projekta");
      }

      onDone();
    } catch (e: any) {
      setError(e.message || "Neočekivana greška");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
        Arhiviranje projekta
      </div>

      <div style={{ opacity: 0.9, marginBottom: 12 }}>
        Ova akcija će zaključati projekat. Nakon toga izmjene neće biti
        dozvoljene.
      </div>

      {error && (
        <div style={{ color: "#ef4444", marginBottom: 10 }}>{error}</div>
      )}

      {needsConfirm && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            borderLeft: "6px solid #f59e0b",
            background: "rgba(245,158,11,0.10)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Postoje upozorenja
          </div>
          <div style={{ opacity: 0.9, marginBottom: 10 }}>
            Projekat ima upozorenja (npr. bank storno). Da li želiš nastaviti?
          </div>

          <button
            className="btn"
            onClick={() => closeProject(true)}
            disabled={loading}
          >
            Da, arhiviraj uprkos upozorenjima
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn"
          onClick={() => closeProject(false)}
          disabled={loading}
        >
          Arhiviraj
        </button>

        <button className="btn" onClick={onCancel} disabled={loading}>
          Otkaži
        </button>
      </div>
    </div>
  );
}
