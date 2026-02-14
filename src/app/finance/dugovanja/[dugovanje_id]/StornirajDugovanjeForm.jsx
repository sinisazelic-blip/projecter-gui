"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StornirajDugovanjeForm({ dugovanjeId }) {
  const router = useRouter();
  const [razlog, setRazlog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/otpis/dugovanje/${dugovanjeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razlog: razlog.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri storniranju");
      router.refresh();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
      <div className="label">Razlog storna (npr. firma ugašena, storno ranijih godina)</div>
      <textarea
        className="input"
        value={razlog}
        onChange={(e) => setRazlog(e.target.value)}
        rows={2}
        placeholder="Opciono"
        style={{ width: "100%", maxWidth: 400, resize: "vertical", marginBottom: 8 }}
      />
      {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <button type="submit" className="btn btn--active" disabled={loading}>
        {loading ? "Šaljem…" : "Storniraj dugovanje"}
      </button>
    </form>
  );
}
