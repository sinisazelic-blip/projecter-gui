"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import Link from "next/link";

const defaultValutaByLocale = (locale) => (locale === "en" ? "EUR" : "BAM");
const currencyOptionsByLocale = (locale) =>
  locale === "en" ? ["EUR", "USD"] : ["BAM", "EUR"];

export default function KreditForm({ initialCredit = null }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const isEdit = !!initialCredit?.kredit_id;
  const [form, setForm] = useState({
    kredit_id: null,
    naziv: "",
    iznos_kredita: "",
    iznos_kamata_troskovi: "",
    ukupan_iznos: "",
    valuta: defaultValutaByLocale(locale),
    broj_rata: "",
    uplaceno_rata: "0",
    iznos_rate: "",
    datum_posljednja_rata: "",
    banka_naziv: "",
    napomena: "",
    aktivan: true,
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const opts = currencyOptionsByLocale(locale);
    setForm((prev) =>
      opts.includes(prev.valuta) ? prev : { ...prev, valuta: defaultValutaByLocale(locale) },
    );
  }, [locale]);

  useEffect(() => {
    if (!initialCredit) return;
    setForm({
      kredit_id: initialCredit.kredit_id ?? null,
      naziv: initialCredit.naziv ?? "",
      iznos_kredita:
        initialCredit.iznos_kredita != null
          ? String(initialCredit.iznos_kredita)
          : "",
      iznos_kamata_troskovi:
        initialCredit.iznos_kamata_troskovi != null
          ? String(initialCredit.iznos_kamata_troskovi)
          : "",
      ukupan_iznos:
        initialCredit.ukupan_iznos != null
          ? String(initialCredit.ukupan_iznos)
          : "",
      valuta: initialCredit.valuta ?? defaultValutaByLocale(locale),
      broj_rata:
        initialCredit.broj_rata != null ? String(initialCredit.broj_rata) : "",
      uplaceno_rata:
        initialCredit.uplaceno_rata != null
          ? String(initialCredit.uplaceno_rata)
          : "0",
      iznos_rate:
        initialCredit.iznos_rate != null ? String(initialCredit.iznos_rate) : "",
      datum_posljednja_rata: initialCredit.datum_posljednja_rata
        ? String(initialCredit.datum_posljednja_rata).slice(0, 10)
        : "",
      banka_naziv: initialCredit.banka_naziv ?? "",
      napomena: initialCredit.napomena ?? "",
      aktivan: Number(initialCredit.aktivan) !== 0,
    });
  }, [initialCredit, locale]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const principal = form.iznos_kredita ? Number(form.iznos_kredita) : 0;
    const costs = form.iznos_kamata_troskovi ? Number(form.iznos_kamata_troskovi) : 0;
    const total = form.ukupan_iznos
      ? Number(form.ukupan_iznos)
      : principal + costs;
    const instalments = form.broj_rata ? Number(form.broj_rata) : 0;
    const computedRate = instalments > 0 ? total / instalments : 0;

    try {
      const res = await fetch("/api/finance/krediti", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          iznos_kredita: principal,
          iznos_kamata_troskovi: costs,
          ukupan_iznos: total,
          broj_rata: form.broj_rata ? Number(form.broj_rata) : 0,
          uplaceno_rata: form.uplaceno_rata ? Number(form.uplaceno_rata) : 0,
          iznos_rate: form.iznos_rate ? Number(form.iznos_rate) : computedRate,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        setMsg({ type: "error", text: json.error || t("krediti.errorGeneric") });
        return;
      }

      setMsg({ type: "ok", text: (t(isEdit ? "krediti.successUpdated" : "krediti.successAdded") || "").replace("{{id}}", json.kredit_id) });
      router.refresh();
      if (isEdit) {
        router.push("/finance/krediti");
      } else {
        setForm({
          kredit_id: null,
          naziv: "",
          iznos_kredita: "",
          iznos_kamata_troskovi: "",
          ukupan_iznos: "",
          valuta: defaultValutaByLocale(locale),
          broj_rata: "",
          uplaceno_rata: "0",
          iznos_rate: "",
          datum_posljednja_rata: "",
          banka_naziv: "",
          napomena: "",
          aktivan: true,
        });
      }
    } catch (err) {
      setMsg({ type: "error", text: err?.message || t("krediti.errorGeneric") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="cardHead">
        <div className="cardTitle">{isEdit ? t("krediti.formTitleEdit") : t("krediti.formTitle")}</div>
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
          <span className="label">{t("krediti.labelIznosKredita")}</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_kredita"
            value={form.iznos_kredita}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <span className="label">{t("krediti.labelKamataTroskovi")}</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_kamata_troskovi"
            value={form.iznos_kamata_troskovi}
            onChange={handleChange}
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
            placeholder={t("krediti.placeholderUkupanIznos")}
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

        <div className="field" style={{ minWidth: 240 }}>
          <span className="label">{t("krediti.labelRatePreview")}</span>
          <input
            className="input"
            value={(() => {
              const principal = Number(form.iznos_kredita || 0);
              const costs = Number(form.iznos_kamata_troskovi || 0);
              const total = form.ukupan_iznos ? Number(form.ukupan_iznos) : principal + costs;
              const br = Number(form.broj_rata || 0);
              if (!Number.isFinite(total) || !Number.isFinite(br) || br <= 0) return "—";
              const rate = total / br;
              const val = form.valuta || defaultValutaByLocale(locale);
              return `${rate.toFixed(2)} ${val}`;
            })()}
            readOnly
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

        {isEdit && (
          <label className="field" style={{ minWidth: 120, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!form.aktivan}
              onChange={(e) => setForm((s) => ({ ...s, aktivan: e.target.checked }))}
            />
            <span className="label">{t("krediti.colActive")}</span>
          </label>
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
          {saving ? t("krediti.saving") : isEdit ? t("krediti.updateButton") : t("krediti.submitButton")}
        </button>
        {isEdit && (
          <Link href="/finance/krediti" className="btn">
            {t("krediti.cancelEdit")}
          </Link>
        )}
      </div>
    </form>
  );
}
