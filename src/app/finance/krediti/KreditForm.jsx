"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KreditForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    naziv: "",
    ukupan_iznos: "",
    valuta: "BAM",
    broj_rata: "",
    uplaceno_rata: "0",
    iznos_rate: "",
    datum_posljednja_rata: "",
    banka_naziv: "",
    napomena: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/finance/krediti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ukupan_iznos: form.ukupan_iznos ? Number(form.ukupan_iznos) : 0,
          broj_rata: form.broj_rata ? Number(form.broj_rata) : 0,
          uplaceno_rata: form.uplaceno_rata ? Number(form.uplaceno_rata) : 0,
          iznos_rate: form.iznos_rate ? Number(form.iznos_rate) : null,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        setMsg({ type: "error", text: json.error || "Greška" });
        return;
      }

      setMsg({ type: "ok", text: `Dodano. Kredit ID: ${json.kredit_id}` });
      router.refresh();
      setForm({
        naziv: "",
        ukupan_iznos: "",
        valuta: "BAM",
        broj_rata: "",
        uplaceno_rata: "0",
        iznos_rate: "",
        datum_posljednja_rata: "",
        banka_naziv: "",
        napomena: "",
      });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Greška" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="cardHead">
        <div className="cardTitle">Dodaj kredit</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">Naziv *</span>
          <input
            className="input"
            name="naziv"
            value={form.naziv}
            onChange={handleChange}
            placeholder="npr. Auto kredit"
            required
          />
        </div>

        <div className="field">
          <span className="label">Ukupan iznos *</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="ukupan_iznos"
            value={form.ukupan_iznos}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <span className="label">Valuta</span>
          <select
            className="input"
            name="valuta"
            value={form.valuta}
            onChange={handleChange}
          >
            <option value="BAM">BAM</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div className="field">
          <span className="label">Broj rata *</span>
          <input
            className="input"
            type="number"
            min="1"
            name="broj_rata"
            value={form.broj_rata}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <span className="label">Uplaćeno rata</span>
          <input
            className="input"
            type="number"
            min="0"
            name="uplaceno_rata"
            value={form.uplaceno_rata}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <span className="label">Iznos rate (po rati)</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_rate"
            value={form.iznos_rate}
            onChange={handleChange}
            placeholder="Ako su jednake"
          />
        </div>

        <div className="field">
          <span className="label">Posljednja rata (dd.mm.yyyy)</span>
          <input
            className="input"
            type="date"
            name="datum_posljednja_rata"
            value={form.datum_posljednja_rata}
            onChange={handleChange}
            placeholder="Mjesec i godina"
          />
        </div>

        <div className="field" style={{ minWidth: 180 }}>
          <span className="label">Banka</span>
          <input
            className="input"
            name="banka_naziv"
            value={form.banka_naziv}
            onChange={handleChange}
            placeholder="npr. NLB"
          />
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">Napomena</span>
          <input
            className="input"
            name="napomena"
            value={form.napomena}
            onChange={handleChange}
          />
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 6,
            background: msg.type === "ok" ? "rgba(55,214,122,.15)" : "rgba(255,80,80,.15)",
            color: msg.type === "ok" ? "#37d67a" : "#ff5050",
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="actions" style={{ marginTop: 12 }}>
        <button type="submit" className="btn btn--active" disabled={saving}>
          {saving ? "Unosim…" : "Dodaj kredit"}
        </button>
      </div>
    </form>
  );
}
