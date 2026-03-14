"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

const defaultValutaByLocale = (locale) => (locale === "en" ? "EUR" : "BAM");
const currencyOptionsByLocale = (locale) =>
  locale === "en" ? ["EUR", "USD"] : ["BAM", "EUR"];

export default function KreditForm() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    naziv: "",
    ukupan_iznos: "",
    valuta: defaultValutaByLocale(locale),
    broj_rata: "",
    uplaceno_rata: "0",
    iznos_rate: "",
    datum_posljednja_rata: "",
    banka_naziv: "",
    napomena: "",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const opts = currencyOptionsByLocale(locale);
    setForm((prev) =>
      opts.includes(prev.valuta) ? prev : { ...prev, valuta: defaultValutaByLocale(locale) },
    );
  }, [locale]);

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
        setMsg({ type: "error", text: json.error || t("krediti.errorGeneric") });
        return;
      }

      setMsg({ type: "ok", text: (t("krediti.successAdded") || "").replace("{{id}}", json.kredit_id) });
      router.refresh();
      setForm({
        naziv: "",
        ukupan_iznos: "",
        valuta: defaultValutaByLocale(locale),
        broj_rata: "",
        uplaceno_rata: "0",
        iznos_rate: "",
        datum_posljednja_rata: "",
        banka_naziv: "",
        napomena: "",
      });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || t("krediti.errorGeneric") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="cardHead">
        <div className="cardTitle">{t("krediti.formTitle")}</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">{t("krediti.labelNaziv")}</span>
          <input
            className="input"
            name="naziv"
            value={form.naziv}
            onChange={handleChange}
            placeholder={t("krediti.placeholderNaziv")}
            required
          />
        </div>

        <div className="field">
          <span className="label">{t("krediti.labelUkupanIznos")}</span>
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
          <span className="label">{t("krediti.labelValuta")}</span>
          <select
            className="input"
            name="valuta"
            value={form.valuta}
            onChange={handleChange}
          >
            {currencyOptionsByLocale(locale).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label">{t("krediti.labelBrojRata")}</span>
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
          <span className="label">{t("krediti.labelUplacenoRata")}</span>
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
          <span className="label">{t("krediti.labelIznosRate")}</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_rate"
            value={form.iznos_rate}
            onChange={handleChange}
            placeholder={t("krediti.placeholderIznosRate")}
          />
        </div>

        <div className="field">
          <span className="label">{t("krediti.labelPosljednjaRata")}</span>
          <input
            className="input"
            type="date"
            name="datum_posljednja_rata"
            value={form.datum_posljednja_rata}
            onChange={handleChange}
            placeholder={t("krediti.placeholderDatum")}
          />
        </div>

        <div className="field" style={{ minWidth: 180 }}>
          <span className="label">{t("krediti.labelBanka")}</span>
          <input
            className="input"
            name="banka_naziv"
            value={form.banka_naziv}
            onChange={handleChange}
            placeholder={t("krediti.placeholderBanka")}
          />
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">{t("krediti.labelNapomena")}</span>
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
          {saving ? t("krediti.saving") : t("krediti.submitButton")}
        </button>
      </div>
    </form>
  );
}
