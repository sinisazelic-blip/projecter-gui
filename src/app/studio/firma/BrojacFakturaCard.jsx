"use client";

import { useState, useEffect, useCallback } from "react";

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
  width: "100%",
  maxWidth: 120,
};
const labelStyle = { fontSize: 12, opacity: 0.75, marginBottom: 6 };

export default function BrojacFakturaCard() {
  const [items, setItems] = useState([]);
  const [sljedeci, setSljedeci] = useState("");
  const [trenutnaGodina, setTrenutnaGodina] = useState(new Date().getFullYear());
  const [godina, setGodina] = useState(String(new Date().getFullYear()));
  const [zadnjiBroj, setZadnjiBroj] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/firma/brojac-faktura");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Greška učitavanja");
      setItems(data?.items ?? []);
      setSljedeci(data?.sljedeci_za_trenutnu_godinu ?? "");
      setTrenutnaGodina(data?.trenutna_godina ?? new Date().getFullYear());
    } catch (e) {
      setError(e?.message || "Nije moguće učitati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const g = parseInt(godina, 10);
    const z = parseInt(zadnjiBroj, 10);
    if (!Number.isFinite(g) || g < 2000 || g > 2100) {
      setError("Godina mora biti između 2000 i 2100.");
      return;
    }
    if (!Number.isFinite(z) || z < 0) {
      setError("Posljednji broj mora biti 0 ili veći.");
      return;
    }
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/firma/brojac-faktura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ godina: g, zadnji_broj_u_godini: z }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Greška snimanja");
      setOkMsg(data?.message || "Sačuvano.");
      setZadnjiBroj("");
      load();
    } catch (e) {
      setError(e?.message || "Nije moguće snimiti");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ marginTop: 20 }}>
        <div className="sectionTitle">Brojač faktura</div>
        <div className="hint">Učitavanje…</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="sectionTitle">Brojač faktura</div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Postavite posljednji izdati broj fakture prije korištenja Fluxe (samo jednom po godini). Od tog trenutka Fluxa preuzima kontrolu — sljedeća faktura dobit će n+1.
      </div>

      {sljedeci ? (
        <p style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 600 }}>
          Sljedeći broj fakture za {trenutnaGodina}:{" "}
          <span className="mono">{sljedeci}</span>
        </p>
      ) : null}

      {error && <div style={{ color: "#f88", marginBottom: 10, fontSize: 13 }}>{error}</div>}
      {okMsg && <div style={{ color: "var(--good)", marginBottom: 10, fontSize: 13 }}>{okMsg}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <div style={labelStyle}>Godina</div>
          <input
            type="number"
            min={2000}
            max={2100}
            value={godina}
            onChange={(e) => setGodina(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Posljednji izdati broj (prije Fluxe)</div>
          <input
            type="number"
            min={0}
            value={zadnjiBroj}
            onChange={(e) => setZadnjiBroj(e.target.value)}
            style={inputStyle}
            placeholder="npr. 42"
          />
        </div>
        <button type="submit" className="btn" disabled={saving} style={{ marginBottom: 0 }}>
          {saving ? "Snimanje…" : "Postavi"}
        </button>
      </form>

      {items.length > 0 ? (
        <div className="hint" style={{ marginTop: 14 }}>
          Postavljene godine:{" "}
          {items
            .sort((a, b) => b.godina - a.godina)
            .map((x) => `${x.godina} → ${x.zadnji_broj_u_godini}`)
            .join(", ")}
        </div>
      ) : null}
    </div>
  );
}
