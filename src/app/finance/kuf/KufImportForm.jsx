"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";

const TIP_RASKNJIZAVANJA_KEYS = [
  { val: "PROJEKTNI_TROSAK", key: "tipProjektniLabel" },
  { val: "FIKSNI_TROSAK", key: "tipFiksniLabel" },
  { val: "VANREDNI_TROSAK", key: "tipVanredniLabel" },
  { val: "INVESTICIJE", key: "tipInvesticijeLabel" },
];

const VANREDNI_PODTIP_KEYS = [
  { val: "SERVIS", key: "podtipServis" },
  { val: "REPRO_MATERIJAL", key: "podtipRepro" },
  { val: "POTROSNI_MATERIJAL", key: "podtipPotrosni" },
];

const CURRENCIES = [{ code: "EUR" }, { code: "USD" }];

export default function KufImportForm({ dobavljaci, klijenti, projekti, fiksniTroskovi }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    broj_fakture: "",
    datum_fakture: "",
    datum_dospijeca: "",
    dobavljac_id: "",
    klijent_id: "",
    partner_naziv: "",
    iznos: "",
    valuta: "EUR",
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
        setMsg({ type: "error", text: json.error || t("kuf.errorGeneric") });
        return;
      }

      setMsg({ type: "ok", text: `${t("kuf.msgImportedPrefix")} ${json.kuf_id}` });
      router.refresh();
      setForm({
        broj_fakture: "",
        datum_fakture: "",
        datum_dospijeca: "",
        dobavljac_id: "",
        klijent_id: "",
        partner_naziv: "",
        iznos: "",
        valuta: "EUR",
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
      setMsg({ type: "error", text: err?.message || t("kuf.errorGeneric") });
    } finally {
      setSaving(false);
    }
  };

  const tip = form.tip_rasknjizavanja;

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="cardHead">
        <div className="cardTitle">{t("kuf.formTitle")}</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field">
          <span className="label">{t("kuf.invoiceNo")}</span>
          <input
            className="input"
            name="broj_fakture"
            value={form.broj_fakture}
            onChange={handleChange}
            placeholder={t("kuf.invoiceNoPlaceholder")}
          />
        </div>

        <div className="field">
          <span className="label">{t("kuf.dateInvoice")}</span>
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
          <span className="label">{t("kuf.dateDue")}</span>
          <input
            className="input"
            type="date"
            name="datum_dospijeca"
            value={form.datum_dospijeca}
            onChange={handleChange}
          />
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">{t("kuf.supplier")}</span>
          <select
            className="input"
            name="dobavljac_id"
            value={form.dobavljac_id}
            onChange={handleChange}
          >
            <option value="">{t("kuf.selectChoose")}</option>
            {(dobavljaci || []).map((d) => (
              <option key={d.dobavljac_id} value={d.dobavljac_id}>
                {d.naziv}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">{t("kuf.client")}</span>
          <select
            className="input"
            name="klijent_id"
            value={form.klijent_id}
            onChange={handleChange}
          >
            <option value="">{t("kuf.selectChoose")}</option>
            {(klijenti || []).map((k) => (
              <option key={k.klijent_id} value={k.klijent_id}>
                {k.naziv_klijenta}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ minWidth: 220 }}>
          <span className="label">{t("kuf.partner")}</span>
          <input
            className="input"
            name="partner_naziv"
            value={form.partner_naziv}
            onChange={handleChange}
            placeholder={t("kuf.partnerPlaceholder")}
          />
        </div>

        <div className="field">
          <span className="label">{t("kuf.amount")}</span>
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
          <span className="label">{t("kuf.currency")}</span>
          <select
            className="input"
            name="valuta"
            value={form.valuta}
            onChange={handleChange}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label">{t("kuf.amountBam")}</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            name="iznos_km"
            value={form.iznos_km}
            onChange={handleChange}
            placeholder={t("kuf.amountBamPlaceholder")}
          />
        </div>

        <div className="field">
          <span className="label">{t("kuf.description")}</span>
          <input
            className="input"
            name="opis"
            value={form.opis}
            onChange={handleChange}
            placeholder={t("kuf.descriptionPlaceholder")}
          />
        </div>

        <div className="field" style={{ minWidth: 200 }}>
          <span className="label">{t("kuf.note")}</span>
          <input
            className="input"
            name="napomena"
            value={form.napomena}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="cardHead" style={{ marginTop: 16 }}>
        <div className="cardTitle">{t("kuf.posting")}</div>
      </div>

      <div className="filters" style={{ flexWrap: "wrap", display: "flex", gap: 12 }}>
        <div className="field" style={{ minWidth: 260 }}>
          <span className="label">{t("kuf.postingType")}</span>
          <select
            className="input"
            name="tip_rasknjizavanja"
            value={form.tip_rasknjizavanja}
            onChange={handleChange}
            required
          >
            {TIP_RASKNJIZAVANJA_KEYS.map((opt) => (
              <option key={opt.val} value={opt.val}>
                {t("kuf." + opt.key)}
              </option>
            ))}
          </select>
        </div>

        {tip === "PROJEKTNI_TROSAK" && (
          <div className="field" style={{ minWidth: 200 }}>
            <span className="label">{t("kuf.project")}</span>
            <select
              className="input"
              name="projekat_id"
              value={form.projekat_id}
              onChange={handleChange}
            >
              <option value="">{t("kuf.selectChoose")}</option>
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
            <span className="label">{t("kuf.fixedCost")}</span>
            <select
              className="input"
              name="fiksni_trosak_id"
              value={form.fiksni_trosak_id}
              onChange={handleChange}
            >
              <option value="">{t("kuf.selectChoose")}</option>
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
            <span className="label">{t("kuf.podtip")}</span>
            <select
              className="input"
              name="vanredni_podtip"
              value={form.vanredni_podtip}
              onChange={handleChange}
            >
              <option value="">{t("kuf.selectChoose")}</option>
              {VANREDNI_PODTIP_KEYS.map((v) => (
                <option key={v.val} value={v.val}>
                  {t("kuf." + v.key)}
                </option>
              ))}
            </select>
          </div>
        )}

        {tip === "INVESTICIJE" && (
          <div className="field" style={{ minWidth: 220 }}>
            <span className="label">{t("kuf.investWhat")}</span>
            <input
              className="input"
              name="investicija_opis"
              value={form.investicija_opis}
              onChange={handleChange}
              placeholder={t("kuf.investPlaceholder")}
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
          {saving ? t("kuf.submitSaving") : t("kuf.submitButton")}
        </button>
      </div>
    </form>
  );
}
