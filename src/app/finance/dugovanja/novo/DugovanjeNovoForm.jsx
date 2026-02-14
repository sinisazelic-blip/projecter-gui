"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DugovanjeNovoForm({ dobavljaci = [] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const form = e.target;
    const payload = {
      datum: form.datum?.value || today,
      datum_dospijeca: form.datum_dospijeca?.value || null,
      iznos_km: form.iznos_km?.value ? Number(form.iznos_km.value) : 0,
      opis: form.opis?.value?.trim() || null,
      napomena: form.napomena?.value?.trim() || null,
      dobavljac_id: form.dobavljac_id?.value ? Number(form.dobavljac_id.value) : null,
      projekat_id: form.projekat_id?.value ? Number(form.projekat_id.value) : null,
    };
    try {
      const res = await fetch("/api/finance/dugovanja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Greška pri snimanju.");
        setSaving(false);
        return;
      }
      const id = data?.dugovanje_id;
      if (id) {
        router.push(`/finance/dugovanja/${id}`);
      } else {
        router.push("/finance/dugovanja");
      }
      router.refresh();
    } catch (err) {
      setError(err?.message || "Greška pri slanju.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 18 }}>
      {error ? (
        <div style={{ marginBottom: 12, padding: 10, background: "rgba(239,68,68,0.15)", borderRadius: 8, color: "var(--bad)" }}>
          {error}
        </div>
      ) : null}
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Datum *</span>
        <input type="date" name="datum" className="input" defaultValue={today} required />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Datum dospijeća</span>
        <input type="date" name="datum_dospijeca" className="input" />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Iznos (KM) *</span>
        <input type="number" name="iznos_km" className="input" step="0.01" min="0" required placeholder="0,00" />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Opis</span>
        <input type="text" name="opis" className="input" placeholder="npr. Faktura br. X, usluga Y" />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Dobavljač</span>
        <select name="dobavljac_id" className="input">
          <option value="">— nije izabran —</option>
          {dobavljaci.map((d) => (
            <option key={d.dobavljac_id} value={d.dobavljac_id}>
              {d.naziv}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="label">Projekat ID (opciono)</span>
        <input type="number" name="projekat_id" className="input" min="0" placeholder="prazno = van projekta" />
      </div>
      <div className="field" style={{ marginBottom: 18 }}>
        <span className="label">Napomena</span>
        <textarea name="napomena" className="input" rows={2} placeholder="Opciono" />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="submit" className="btn btn--active" disabled={saving}>
          {saving ? "Snimam…" : "Snimi dugovanje"}
        </button>
        <Link href="/finance/dugovanja" className="btn">
          Odustani
        </Link>
      </div>
    </form>
  );
}
