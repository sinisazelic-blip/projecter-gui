"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ZakljuciGodinuModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/finance/analize/year-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Greška pri zaključenju godine.");
      }
      setResult(data);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Došlo je do greške.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn--active"
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#fff",
          border: "none",
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
        }}
      >
        <span>🏁</span> Zaključenje godine (Prenos salda)
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: "var(--panel, #18181b)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: 16,
              maxWidth: 540,
              width: "100%",
              padding: 24,
              color: "var(--text, #f4f4f5)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🏁</span>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Zaključenje godine & Prenos salda
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted, #a1a1aa)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {!result ? (
              <>
                <p style={{ fontSize: 13.5, color: "var(--muted, #a1a1aa)", lineHeight: 1.6, marginBottom: 16 }}>
                  Ovaj alat vrši formalno računovodstveno usklađivanje i automatski prenosi preostala
                  stvarna potraživanja i obaveze u novu poslovnu godinu (početna stanja za <b>{year + 1}.</b>).
                </p>

                <div
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border, #27272a)",
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6, color: "#38bdf8" }}>
                    🔄 Šta sistem automatski obuhvata:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: "var(--muted, #a1a1aa)" }}>
                    <li><b>Klijenti:</b> Preostala nenaplaćena potraživanja po fakturama i izvodima</li>
                    <li><b>Dobavljači:</b> Neisplaćene obaveze po računima i projektima</li>
                    <li><b>Saradnici / Talenti:</b> Neisplaćeni honorari i preostali saldo</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="label" style={{ display: "block", marginBottom: 6 }}>
                    Poslovna godina koja se zaključuje:
                  </label>
                  <select
                    className="input"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 15 }}
                  >
                    <option value={2025}>2025. godina (prenos u 2026.)</option>
                    <option value={2026}>2026. godina (prenos u 2027.)</option>
                    <option value={2027}>2027. godina (prenos u 2028.)</option>
                  </select>
                </div>

                {error && (
                  <div
                    style={{
                      padding: 12,
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid #ef4444",
                      borderRadius: 8,
                      color: "#fca5a5",
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    ⚠️ {error}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn" onClick={handleClose} disabled={loading}>
                    Odustani
                  </button>
                  <button
                    type="button"
                    className="btn btn--active"
                    onClick={handleExecute}
                    disabled={loading}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    {loading ? "Obrada salda u toku..." : `Zaključi ${year}. i prenesi za ${year + 1}.`}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div
                  style={{
                    padding: 16,
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10b981",
                    borderRadius: 8,
                    marginBottom: 16,
                    color: "#6ee7b7",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    ✅ Godina {result.year}. uspješno zaključena!
                  </div>
                  <div>Početna stanja za <b>{result.next_year}. godinu</b> su ažurirana:</div>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                    <li>Preneseno klijenata: <b>{result.carried?.klijenti ?? 0}</b></li>
                    <li>Preneseno dobavljača: <b>{result.carried?.dobavljaci ?? 0}</b></li>
                    <li>Preneseno saradnika: <b>{result.carried?.saradnici ?? 0}</b></li>
                  </ul>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn--active" onClick={handleClose}>
                    Zatvori i osvježi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
