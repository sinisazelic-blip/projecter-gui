"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/components/LocaleProvider";

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
  const { t } = useTranslation();
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
      if (!res.ok) throw new Error(data?.error || t("firma.brojacErrorLoad"));
      setItems(data?.items ?? []);
      setSljedeci(data?.sljedeci_za_trenutnu_godinu ?? "");
      setTrenutnaGodina(data?.trenutna_godina ?? new Date().getFullYear());
    } catch (e) {
      setError(e?.message || t("firma.brojacErrorLoadGeneric"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const g = parseInt(godina, 10);
    const z = parseInt(zadnjiBroj, 10);
    if (!Number.isFinite(g) || g < 2000 || g > 2100) {
      setError(t("firma.brojacErrorYear"));
      return;
    }
    if (!Number.isFinite(z) || z < 0) {
      setError(t("firma.brojacErrorZadnji"));
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
      if (!res.ok) throw new Error(data?.error || t("firma.brojacErrorSave"));
      setOkMsg(data?.message || t("firma.brojacOk"));
      setZadnjiBroj("");
      load();
    } catch (e) {
      setError(e?.message || t("firma.brojacErrorSaveGeneric"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ marginTop: 20 }}>
        <div className="sectionTitle">{t("firma.brojacTitle")}</div>
        <div className="hint">{t("firma.brojacLoading")}</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="sectionTitle">{t("firma.brojacTitle")}</div>
      <div className="hint" style={{ marginBottom: 12 }}>
        {t("firma.brojacHint")}
      </div>

      {sljedeci ? (
        <p style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 600 }}>
          {(t("firma.brojacNextFor") || "").replace("{{year}}", String(trenutnaGodina))}{" "}
          <span className="mono">{sljedeci}</span>
        </p>
      ) : null}

      {error && <div style={{ color: "#f88", marginBottom: 10, fontSize: 13 }}>{error}</div>}
      {okMsg && <div style={{ color: "var(--good)", marginBottom: 10, fontSize: 13 }}>{okMsg}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <div style={labelStyle}>{t("firma.brojacLabelGodina")}</div>
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
          <div style={labelStyle}>{t("firma.brojacLabelZadnji")}</div>
          <input
            type="number"
            min={0}
            value={zadnjiBroj}
            onChange={(e) => setZadnjiBroj(e.target.value)}
            style={inputStyle}
            placeholder={t("firma.brojacPlaceholder")}
          />
        </div>
        <button type="submit" className="btn" disabled={saving} style={{ marginBottom: 0 }}>
          {saving ? t("firma.brojacSaving") : t("firma.brojacSubmit")}
        </button>
      </form>

      {items.length > 0 ? (
        <div className="hint" style={{ marginTop: 14 }}>
          {t("firma.brojacSetYears")}{" "}
          {items
            .sort((a, b) => b.godina - a.godina)
            .map((x) => `${x.godina} → ${x.zadnji_broj_u_godini}`)
            .join(", ")}
        </div>
      ) : null}
    </div>
  );
}
