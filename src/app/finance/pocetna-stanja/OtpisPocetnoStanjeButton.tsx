"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tip = "klijent" | "dobavljac" | "talent";

export default function OtpisPocetnoStanjeButton({
  tip,
  refId,
  disabled,
  children = "Otpisi",
}: {
  tip: Tip;
  refId: number;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [razlog, setRazlog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/otpis/pocetna-stanje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tip, ref_id: refId, razlog: razlog.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Greška pri otpisu");
      setOpen(false);
      setRazlog("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ fontSize: 12 }}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <form
          onSubmit={handleSubmit}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="card"
            style={{
              padding: 20,
              minWidth: 320,
              maxWidth: 400,
              background: "var(--panel)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Otpis početnog stanja</div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Označićeš ovu stavku kao otpisanu (nenaplativo / storno). Razlog je opcionalan ali preporučen.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label className="label" style={{ display: "block", marginBottom: 4 }}>
                Razlog (npr. firma ugašena, nenaplativo)
              </label>
              <textarea
                className="input"
                value={razlog}
                onChange={(e) => setRazlog(e.target.value)}
                rows={2}
                placeholder="Opciono"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            {error && (
              <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Odustani
              </button>
              <button type="submit" className="btn btn--active" disabled={loading}>
                {loading ? "Šaljem…" : "Otpisi"}
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
