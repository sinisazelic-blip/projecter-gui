"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KufStatusToggle({ kufId, initialStatus, datumDospijeca }) {
  const [status, setStatus] = useState(initialStatus || "CEKA");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isPaid = status === "PLACENO" || status === "RASKNJIZENO";
  
  // Provjera dospijeća
  let isOverdue = false;
  if (!isPaid && datumDospijeca) {
    const dosp = new Date(datumDospijeca);
    if (!Number.isNaN(dosp.getTime()) && dosp < new Date()) {
      isOverdue = true;
    }
  }

  async function toggleStatus() {
    const newStatus = isPaid ? "CEKA" : "PLACENO";
    setLoading(true);
    try {
      const res = await fetch("/api/finance/kuf", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kuf_id: kufId, status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus(newStatus);
        router.refresh();
      } else {
        alert(json.error || "Greška pri promjeni statusa");
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 800,
          background: isPaid
            ? "rgba(16, 185, 129, 0.18)"
            : isOverdue
            ? "rgba(239, 68, 68, 0.18)"
            : "rgba(245, 158, 11, 0.18)",
          color: isPaid ? "#10b981" : isOverdue ? "#ef4444" : "#f59e0b",
          border: isPaid
            ? "1px solid rgba(16, 185, 129, 0.4)"
            : isOverdue
            ? "1px solid rgba(239, 68, 68, 0.4)"
            : "1px solid rgba(245, 158, 11, 0.4)",
        }}
      >
        <span>{isPaid ? "●" : isOverdue ? "▲" : "○"}</span>
        {isPaid ? "PLAĆENO" : isOverdue ? "DOSPIJELO" : "ČEKA"}
      </span>

      <button
        type="button"
        onClick={toggleStatus}
        disabled={loading}
        title={isPaid ? "Vrati u status Čeka" : "Označi kao Plaćeno"}
        style={{
          background: "transparent",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#94a3b8",
          padding: "2px 6px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 10,
        }}
      >
        {loading ? "..." : isPaid ? "↺" : "✓"}
      </button>
    </div>
  );
}
