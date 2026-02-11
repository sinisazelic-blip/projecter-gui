"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIP_RASKNJIZAVANJA = [
  { val: "PROJEKTNI_TROSAK", label: "Projektni trošak (dobavljač)" },
  { val: "FIKSNI_TROSAK", label: "Fiksni trošak" },
  { val: "VANREDNI_TROSAK", label: "Vanredni trošak" },
  { val: "INVESTICIJE", label: "Investicije" },
];

const VANREDNI_PODTIP = [
  { val: "SERVIS", label: "Servis" },
  { val: "REPRO_MATERIJAL", label: "Repro materijal" },
  { val: "POTROSNI_MATERIJAL", label: "Potrošni materijal" },
];

export default function KufImportForm({ dobavljaci, klijenti, projekti, fiksniTroskovi }) {
  const router = useRouter();
  const [form, setForm] = useState({
    broj_fakture: "",
    datum_fakture: "",
    datum_dospijeca: "",
    dobavljac_id: "",
    klijent_id: "",
    partner_naziv: "",
    iznos: "",
    valuta: "BAM",
    iznos_km: "",
    kurs: "",
    opis: "",
    napomena: "",
    tip_rasknjizavanja: "PROJEKTNI_TROSAK",
    projekat_id: "",
    fiksni_trosak_id: "",
    vanredni_podtip: "",
    investicija_opis: "",
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

    const payload = {
      ...form,
      dobavljac_id: form.dobavljac_id ? Number(form.dobavljac_id) : null,
      klijent_id: form.klijent_id ? Number(form.klijent_id) : null,
      projekat_id: form.projekat_id ? Number(form.projekat_id) : null,
      fiksni_trosak_id: form.fiksni_trosak_id ? Number(form.fiksni_trosak_id) : null,
      iznos: form.iznos ? Number(form.iznos) : 0,
      iznos_km: form.iznos_km ? Number(form.iznos_km) : null,
      kurs: form.kurs ? Number(form.kurs) : null,
    };

    try {
      const res = await fetch("/api/finance/kuf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.ok) {
        setMsg({ type: "error", text: json.error || "Greška" });
        return;
      }

      setMsg({ type: "ok", text: `Uvezeno. KUF ID: ${json.kuf_id}` });
      router.refresh();
      setForm({
        broj_fakture: "",
        datum_fakture: "",
        datum_dospijeca: "",
        dobavljac_id: "",
        klijent_id: "",
        partner_naziv: "",
        iznos: "",
        valuta: "BAM",
        iznos_km: "",
        kurs: "",
        opis: "",
        napomena: "",
        tip_rasknjizavanja: form.tip_rasknjizavanja,
        projekat_id: "",
        fiksni_trosak_id: "",
        vanredni_podtip: "",
        investicija_opis: "",
      });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Greška" });
    } finally {
      setSaving(false);
    }
  };

  const tip = form.tip_rasknjizavanja;

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="cardHead">
        <div className="cardTitle">Unos ulazne fakture (KUF)</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field">
          <span className="label">Broj fakture</span>
          <input
            className="input"
            name="broj_fakture"
            value={form.broj_fakture}
            onChange={handleChange}
            placeholder="npr. 123/2025"
          />
        </div>

        <div className="field">
          <span className="label">Datum fakture * (dd.mm.yyyy)</span>
          <input
            className="input"
            type="date"
            name="datum_fakture"
            value={form.datum_fakture}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <span className="label">Datum dospijeća (dd.mm.yyyy)</span>
          <input
            className="input"
            type="date"
            name="datum_dospijeca"
            value={form.datum_dospijeca}
            onChange={handleChange}
          />
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">Dobavljač (iz šifarnika)</span>
          <select
            className="input"
            name="dobavljac_id"
            value={form.dobavljac_id}
            onChange={handleChange}
          >
            <option value="">— Izaberi —</option>
            {(dobavljaci || []).map((d) => (
              <option key={d.dobavljac_id} value={d.dobavljac_id}>
                {d.naziv}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">Klijent (ako je partner u klijentima)</span>
          <select
            className="input"
            name="klijent_id"
            value={form.klijent_id}
            onChange={handleChange}
          >
            <option value="">— Izaberi —</option>
            {(klijenti || []).map((k) => (
              <option key={k.klijent_id} value={k.klijent_id}>
                {k.naziv_klijenta}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ minWidth: 220 }}>
          <span className="label">Partner (naziv ako nije u šifarniku)</span>
          <input
            className="input"
            name="partner_naziv"
            value={form.partner_naziv}
            onChange={handleChange}
            placeholder="npr. Neka firma d.o.o."
          />
        </div>

        <div className="field">
          <span className="label">Iznos *</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos"
            value={form.iznos}
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
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="field">
          <span className="label">Iznos (KM)</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_km"
            value={form.iznos_km}
            onChange={handleChange}
            placeholder="Ako nije BAM"
          />
        </div>

        <div className="field">
          <span className="label">Opis stavke</span>
          <input
            className="input"
            name="opis"
            value={form.opis}
            onChange={handleChange}
            placeholder="npr. Usluge repro materijala"
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

      <div className="cardHead" style={{ marginTop: 16 }}>
        <div className="cardTitle">Rasknjižavanje</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field" style={{ minWidth: 260 }}>
          <span className="label">Tip rasknjižavanja *</span>
          <select
            className="input"
            name="tip_rasknjizavanja"
            value={form.tip_rasknjizavanja}
            onChange={handleChange}
            required
          >
            {TIP_RASKNJIZAVANJA.map((t) => (
              <option key={t.val} value={t.val}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {tip === "PROJEKTNI_TROSAK" && (
          <div className="field" style={{ minWidth: 200 }}>
            <span className="label">Projekat</span>
            <select
              className="input"
              name="projekat_id"
              value={form.projekat_id}
              onChange={handleChange}
            >
              <option value="">— Izaberi —</option>
              {(projekti || []).map((p) => (
                <option key={p.projekat_id} value={p.projekat_id}>
                  #{p.projekat_id} {p.radni_naziv}
                </option>
              ))}
            </select>
          </div>
        )}

        {tip === "FIKSNI_TROSAK" && (
          <div className="field" style={{ minWidth: 200 }}>
            <span className="label">Fiksni trošak</span>
            <select
              className="input"
              name="fiksni_trosak_id"
              value={form.fiksni_trosak_id}
              onChange={handleChange}
            >
              <option value="">— Izaberi —</option>
              {(fiksniTroskovi || []).map((f) => (
                <option key={f.trosak_id} value={f.trosak_id}>
                  {f.naziv_troska}
                </option>
              ))}
            </select>
          </div>
        )}

        {tip === "VANREDNI_TROSAK" && (
          <div className="field" style={{ minWidth: 200 }}>
            <span className="label">Podtip</span>
            <select
              className="input"
              name="vanredni_podtip"
              value={form.vanredni_podtip}
              onChange={handleChange}
            >
              <option value="">— Izaberi —</option>
              {VANREDNI_PODTIP.map((v) => (
                <option key={v.val} value={v.val}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {tip === "INVESTICIJE" && (
          <div className="field" style={{ minWidth: 220 }}>
            <span className="label">Šta je (oprema, uređaji…)</span>
            <input
              className="input"
              name="investicija_opis"
              value={form.investicija_opis}
              onChange={handleChange}
              placeholder="npr. Kupovina monitora"
            />
          </div>
        )}
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
          {saving ? "Unosim…" : "Unesi KUF"}
        </button>
      </div>
    </form>
  );
}
