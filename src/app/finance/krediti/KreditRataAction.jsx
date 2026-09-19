"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KreditRataAction({ kreditId, uplacenoRata, brojRata, iznosRate }) {
  const [uplaceno, setUplaceno] = useState(uplacenoRata || 0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdvance() {
    if (uplaceno >= brojRata) {
      alert("Sve rate ovog kredita su već uplaćene!");
      return;
    }
    if (!confirm(`Potvrdite evidentiranje uplate rate (${iznosRate ? Number(iznosRate).toFixed(2) + " KM" : "1 rata"})?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/finance/krediti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kredit_id: kreditId,
          action: "advance_payment",
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setUplaceno(json.uplaceno_rata);
        router.refresh();
      } else {
        alert(json.error || "Greška pri evidenciji rate");
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={handleAdvance}
        disabled={loading || uplaceno >= brojRata}
        title="Uplati sljedeću ratu iz izvoda"
        style={{
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid #10b981",
          color: "#10b981",
          padding: "3px 8px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {loading ? "..." : "+ Rata"}
      </button>
    </div>
  );
}
