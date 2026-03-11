"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import FazeGantt from "./FazeGantt";

function fmtDate(v, locale) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!d || !m || !y) return s;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10) - 1;
  const day = parseInt(d, 10);
  if (locale === "en") {
    return new Date(year, month, day).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return `${d}.${m}.${y}`;
}

export default function FazeClient({ projekatId, rokGlavni, radneFaze, radnici, dobavljaci, locale: localeProp, readOnly = false }) {
  const { t, locale: ctxLocale } = useTranslation();
  const locale = localeProp ?? ctxLocale ?? "sr";
  const [faze, setFaze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [dobavljacFilter, setDobavljacFilter] = useState("");
  const [radnikFilter, setRadnikFilter] = useState("");
  const [viewTab, setViewTab] = useState("tabela");

  const [form, setForm] = useState({
    faza_id: "",
    naziv: "",
    datum_pocetka: "",
    datum_kraja: "",
    deadline: "",
    procenat_izvrsenosti: 0,
    dobavljac_ids: [],
    radnik_ids: [],
  });

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projekatId}/faze`, { cache: "no-store" });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("fazePage.errorGeneric"));
      setFaze(j.faze || []);
    } catch (e) {
      setErr(e?.message || t("fazePage.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [projekatId]);

  async function handleAdd(e) {
    e.preventDefault();
    setErr("");
    if (rokGlavni) {
      const dateStr = fmtDate(rokGlavni, locale);
      if (form.deadline && form.deadline > rokGlavni) {
        setErr(t("fazePage.errDeadlineAfterProject").replace("{date}", dateStr));
        return;
      }
      if (form.datum_kraja && form.datum_kraja > rokGlavni) {
        setErr(t("fazePage.errEndAfterProject").replace("{date}", dateStr));
        return;
      }
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projekatId}/faze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faza_id: form.faza_id || null,
          naziv: form.naziv || null,
          datum_pocetka: form.datum_pocetka || null,
          datum_kraja: form.datum_kraja || null,
          deadline: form.deadline || null,
          procenat_izvrsenosti: Number(form.procenat_izvrsenosti) || 0,
          dobavljac_ids: form.dobavljac_ids,
          radnik_ids: form.radnik_ids,
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("fazePage.errorGeneric"));
      setForm({ faza_id: "", naziv: "", datum_pocetka: "", datum_kraja: "", deadline: "", procenat_izvrsenosti: 0, dobavljac_ids: [], radnik_ids: [] });
      await load();
    } catch (e) {
      setErr(e?.message || t("fazePage.errorGeneric"));
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(fazaId, patch) {
    setErr("");
    try {
      const res = await fetch(`/api/projects/${projekatId}/faze/${fazaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("fazePage.errorGeneric"));
      await load();
    } catch (e) {
      setErr(e?.message || t("fazePage.errorGeneric"));
    }
  }

  async function handleDelete(fazaId) {
    if (!confirm(t("fazePage.confirmDeletePhase"))) return;
    setErr("");
    try {
      const res = await fetch(`/api/projects/${projekatId}/faze/${fazaId}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || t("fazePage.errorGeneric"));
      await load();
    } catch (e) {
      setErr(e?.message || t("fazePage.errorGeneric"));
    }
  }

  function toggleDobavljac(did) {
    setForm((s) => ({
      ...s,
      dobavljac_ids: s.dobavljac_ids.includes(did)
        ? s.dobavljac_ids.filter((x) => x !== did)
        : [...s.dobavljac_ids, did],
    }));
  }

  function toggleRadnik(rid) {
    setForm((s) => ({
      ...s,
      radnik_ids: s.radnik_ids.includes(rid)
        ? s.radnik_ids.filter((x) => x !== rid)
        : [...s.radnik_ids, rid],
    }));
  }

  if (loading) return <div className="card">{t("fazePage.loading")}</div>;

  return (
    <div className="fazePage">
      {rokGlavni && (
        <div className="card subtle" style={{ marginBottom: 14 }}>
          {t("fazePage.masterDeadlineCard")} <b>{fmtDate(rokGlavni, locale)}</b> {t("fazePage.masterDeadlineHint")}
        </div>
      )}

      {err && (
        <div className="card" style={{ marginBottom: 14, borderColor: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
          {err}
        </div>
      )}

      {!readOnly && (
      <form onSubmit={handleAdd} className="card fazeForm">
        <div className="fazeFormTitle">{t("fazePage.addPhaseFormTitle")}</div>
        <div className="fazeFormGrid">
          <div className="field">
            <label className="label">{t("fazePage.labelPhaseType")}</label>
            <select
              value={form.faza_id}
              onChange={(e) => setForm((s) => ({ ...s, faza_id: e.target.value }))}
              className="input"
            >
              <option value="">{t("fazePage.selectOption")}</option>
              {radneFaze.map((rf) => (
                <option key={rf.faza_id} value={rf.faza_id}>
                  {rf.naziv}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelNameOverride")}</label>
            <input
              className="input"
              value={form.naziv}
              onChange={(e) => setForm((s) => ({ ...s, naziv: e.target.value }))}
              placeholder={t("fazePage.namePlaceholder")}
            />
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelStart")}</label>
            <input
              type="date"
              className="input"
              value={form.datum_pocetka}
              onChange={(e) => setForm((s) => ({ ...s, datum_pocetka: e.target.value }))}
            />
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelEnd")}</label>
            <input
              type="date"
              className="input"
              value={form.datum_kraja}
              onChange={(e) => setForm((s) => ({ ...s, datum_kraja: e.target.value }))}
              max={rokGlavni || undefined}
              title={rokGlavni ? t("fazePage.maxDeadlineTitle").replace("{date}", fmtDate(rokGlavni, locale)) : undefined}
            />
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelDeadline")}</label>
            <input
              type="date"
              className="input"
              value={form.deadline}
              onChange={(e) => setForm((s) => ({ ...s, deadline: e.target.value }))}
              max={rokGlavni || undefined}
              placeholder={rokGlavni ? t("fazePage.emptyEqualsDeadline").replace("{date}", fmtDate(rokGlavni, locale)) : ""}
              title={rokGlavni ? t("fazePage.maxDeadlineTitle").replace("{date}", fmtDate(rokGlavni, locale)) : undefined}
            />
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelPercentDone")}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              value={form.procenat_izvrsenosti}
              onChange={(e) => setForm((s) => ({ ...s, procenat_izvrsenosti: e.target.value }))}
              placeholder={t("fazePage.percentPlaceholder")}
            />
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelSuppliers")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("fazePage.searchSuppliers")}
              value={dobavljacFilter}
              onChange={(e) => setDobavljacFilter(e.target.value)}
              style={{ marginBottom: 8, fontSize: 13 }}
            />
            <div className="checkboxGroup" style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, padding: 8 }}>
              {dobavljaci
                .filter((d) => !dobavljacFilter || d.naziv.toLowerCase().includes(dobavljacFilter.toLowerCase()))
                .map((d) => (
                  <label key={d.dobavljac_id} className="checkboxLabel">
                    <input
                      type="checkbox"
                      checked={form.dobavljac_ids.includes(d.dobavljac_id)}
                      onChange={() => toggleDobavljac(d.dobavljac_id)}
                    />
                    {d.naziv}
                  </label>
                ))}
              {dobavljaci.length === 0 && <span className="muted">{t("fazePage.noSuppliers")}</span>}
              {dobavljacFilter && dobavljaci.filter((d) => d.naziv.toLowerCase().includes(dobavljacFilter.toLowerCase())).length === 0 && (
                <span className="muted">{t("fazePage.noResultsFor").replace("{q}", dobavljacFilter)}</span>
              )}
            </div>
            {form.dobavljac_ids.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                {t("fazePage.selectedCount")} {form.dobavljac_ids.length === 1
                  ? t("fazePage.supplierCount_one").replace("{n}", form.dobavljac_ids.length)
                  : t("fazePage.supplierCount_other").replace("{n}", form.dobavljac_ids.length)}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">{t("fazePage.labelWorkers")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("fazePage.searchWorkers")}
              value={radnikFilter}
              onChange={(e) => setRadnikFilter(e.target.value)}
              style={{ marginBottom: 8, fontSize: 13 }}
            />
            <div className="checkboxGroup" style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, padding: 8 }}>
              {radnici
                .filter((r) => {
                  if (!radnikFilter) return true;
                  const search = radnikFilter.toLowerCase();
                  return `${r.ime} ${r.prezime}`.toLowerCase().includes(search);
                })
                .map((r) => (
                  <label key={r.radnik_id} className="checkboxLabel">
                    <input
                      type="checkbox"
                      checked={form.radnik_ids.includes(r.radnik_id)}
                      onChange={() => toggleRadnik(r.radnik_id)}
                    />
                    {r.ime} {r.prezime}
                  </label>
                ))}
              {radnici.length === 0 && <span className="muted">{t("fazePage.noWorkers")}</span>}
              {radnikFilter && radnici.filter((r) => `${r.ime} ${r.prezime}`.toLowerCase().includes(radnikFilter.toLowerCase())).length === 0 && (
                <span className="muted">{t("fazePage.noResultsFor").replace("{q}", radnikFilter)}</span>
              )}
            </div>
            {form.radnik_ids.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                {t("fazePage.selectedCount")} {form.radnik_ids.length === 1
                  ? t("fazePage.workerCount_one").replace("{n}", form.radnik_ids.length)
                  : t("fazePage.workerCount_other").replace("{n}", form.radnik_ids.length)}
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn" disabled={adding}>
          {adding ? t("fazePage.addingPhase") : t("fazePage.addPhaseBtn")}
        </button>
      </form>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div className="fazeFormTitle" style={{ marginBottom: 0 }}>{t("fazePage.phaseListTitle")}</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 13, padding: "6px 12px", opacity: viewTab === "tabela" ? 1 : 0.6 }}
              onClick={() => setViewTab("tabela")}
            >
              {t("fazePage.viewTable")}
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 13, padding: "6px 12px", opacity: viewTab === "timeline" ? 1 : 0.6 }}
              onClick={() => setViewTab("timeline")}
            >
              {t("fazePage.viewTimeline")}
            </button>
          </div>
        </div>

        {viewTab === "tabela" && (
        <div className="table-wrap">
          <table className="fazeTable">
            <thead>
              <tr>
                <th>{t("fazePage.colTypeName")}</th>
                <th>{t("fazePage.colStart")}</th>
                <th>{t("fazePage.colEnd")}</th>
                <th>{t("fazePage.colDeadline")}</th>
                <th>{t("fazePage.colPercent")}</th>
                <th>{t("fazePage.colSuppliers")}</th>
                <th>{t("fazePage.colWorkers")}</th>
                {!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {faze.length === 0 && (
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="muted">
                    {t("fazePage.noPhases")}
                  </td>
                </tr>
              )}
              {faze.map((f) => (
                <tr key={`${f.projekat_faza_id}-${f.procenat_izvrsenosti}`}>
                  <td>
                    {f.faza_naziv || f.naziv || "—"}
                    {f.naziv && f.faza_naziv && ` (${f.naziv})`}
                  </td>
                  <td>{fmtDate(f.datum_pocetka, locale)}</td>
                  <td>{fmtDate(f.datum_kraja, locale)}</td>
                  <td>{fmtDate(f.deadline, locale)}</td>
                  <td>
                    {readOnly ? (
                      (f.procenat_izvrsenosti ?? 0)
                    ) : (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={f.procenat_izvrsenosti ?? 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v >= 0 && v <= 100)
                            handleUpdate(f.projekat_faza_id, { procenat_izvrsenosti: v });
                        }}
                        className="fazeProcenatInput"
                        style={{ padding: 6 }}
                      />
                    )}
                  </td>
                  <td>
                    {f.dobavljaci?.length ? f.dobavljaci.map((d) => d.naziv).join(", ") : "—"}
                  </td>
                  <td>
                    {f.radnici?.length ? f.radnici.map((r) => `${r.ime} ${r.prezime}`).join(", ") : "—"}
                  </td>
                  {!readOnly && (
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                      onClick={() => handleDelete(f.projekat_faza_id)}
                      title={t("fazePage.deletePhaseTitle")}
                    >
                      🗑
                    </button>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {viewTab === "timeline" && <FazeGantt faze={faze} locale={locale} />}
      </div>
    </div>
  );
}
