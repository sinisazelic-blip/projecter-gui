"use client";

import { useEffect, useState } from "react";
import FazeGantt from "./FazeGantt";

function fmtDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}.${m}.${y}` : s;
}

export default function FazeClient({ projekatId, rokGlavni, radneFaze, radnici, dobavljaci }) {
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
      if (!j?.ok) throw new Error(j?.error || "Greška");
      setFaze(j.faze || []);
    } catch (e) {
      setErr(e?.message || "Greška");
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
      if (form.deadline && form.deadline > rokGlavni) {
        setErr(`Deadline faze ne smije biti poslije deadline-a projekta (${fmtDate(rokGlavni)}).`);
        return;
      }
      if (form.datum_kraja && form.datum_kraja > rokGlavni) {
        setErr(`Datum kraja faze ne smije biti poslije deadline-a projekta (${fmtDate(rokGlavni)}).`);
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
      if (!j?.ok) throw new Error(j?.error || "Greška");
      setForm({ faza_id: "", naziv: "", datum_pocetka: "", datum_kraja: "", deadline: "", procenat_izvrsenosti: 0, dobavljac_ids: [], radnik_ids: [] });
      await load();
    } catch (e) {
      setErr(e?.message || "Greška");
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
      if (!j?.ok) throw new Error(j?.error || "Greška");
      await load();
    } catch (e) {
      setErr(e?.message || "Greška");
    }
  }

  async function handleDelete(fazaId) {
    if (!confirm("Obrisati ovu fazu?")) return;
    setErr("");
    try {
      const res = await fetch(`/api/projects/${projekatId}/faze/${fazaId}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Greška");
      await load();
    } catch (e) {
      setErr(e?.message || "Greška");
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

  if (loading) return <div className="card">Učitavanje…</div>;

  return (
    <div className="fazePage">
      {rokGlavni && (
        <div className="card subtle" style={{ marginBottom: 14 }}>
          Master deadline projekta: <b>{fmtDate(rokGlavni)}</b> — faze bez posebnog deadline-a koriste ovaj datum.
        </div>
      )}

      {err && (
        <div className="card" style={{ marginBottom: 14, borderColor: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
          {err}
        </div>
      )}

      <form onSubmit={handleAdd} className="card fazeForm">
        <div className="fazeFormTitle">Dodaj fazu</div>
        <div className="fazeFormGrid">
          <div className="field">
            <label className="label">Tip faze (šifrarnik)</label>
            <select
              value={form.faza_id}
              onChange={(e) => setForm((s) => ({ ...s, faza_id: e.target.value }))}
              className="input"
            >
              <option value="">— izaberi —</option>
              {radneFaze.map((rf) => (
                <option key={rf.faza_id} value={rf.faza_id}>
                  {rf.naziv}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Naziv (override)</label>
            <input
              className="input"
              value={form.naziv}
              onChange={(e) => setForm((s) => ({ ...s, naziv: e.target.value }))}
              placeholder="npr. Mix 1"
            />
          </div>

          <div className="field">
            <label className="label">Početak</label>
            <input
              type="date"
              className="input"
              value={form.datum_pocetka}
              onChange={(e) => setForm((s) => ({ ...s, datum_pocetka: e.target.value }))}
            />
          </div>

          <div className="field">
            <label className="label">Kraj</label>
            <input
              type="date"
              className="input"
              value={form.datum_kraja}
              onChange={(e) => setForm((s) => ({ ...s, datum_kraja: e.target.value }))}
              max={rokGlavni || undefined}
              title={rokGlavni ? `Maks. ${fmtDate(rokGlavni)} (deadline projekta)` : undefined}
            />
          </div>

          <div className="field">
            <label className="label">Deadline</label>
            <input
              type="date"
              className="input"
              value={form.deadline}
              onChange={(e) => setForm((s) => ({ ...s, deadline: e.target.value }))}
              max={rokGlavni || undefined}
              placeholder={rokGlavni ? `Prazno = ${fmtDate(rokGlavni)}` : ""}
              title={rokGlavni ? `Maks. ${fmtDate(rokGlavni)} (deadline projekta)` : undefined}
            />
          </div>

          <div className="field">
            <label className="label">% završetka</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              value={form.procenat_izvrsenosti}
              onChange={(e) => setForm((s) => ({ ...s, procenat_izvrsenosti: e.target.value }))}
              placeholder="0–100"
            />
          </div>

          <div className="field">
            <label className="label">Dobavljači</label>
            <input
              type="text"
              className="input"
              placeholder="Pretraži dobavljače..."
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
              {dobavljaci.length === 0 && <span className="muted">Nema dobavljača</span>}
              {dobavljacFilter && dobavljaci.filter((d) => d.naziv.toLowerCase().includes(dobavljacFilter.toLowerCase())).length === 0 && (
                <span className="muted">Nema rezultata za "{dobavljacFilter}"</span>
              )}
            </div>
            {form.dobavljac_ids.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Izabrano: {form.dobavljac_ids.length} {form.dobavljac_ids.length === 1 ? "dobavljač" : "dobavljača"}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Radnici</label>
            <input
              type="text"
              className="input"
              placeholder="Pretraži radnike..."
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
              {radnici.length === 0 && <span className="muted">Nema radnika</span>}
              {radnikFilter && radnici.filter((r) => `${r.ime} ${r.prezime}`.toLowerCase().includes(radnikFilter.toLowerCase())).length === 0 && (
                <span className="muted">Nema rezultata za "{radnikFilter}"</span>
              )}
            </div>
            {form.radnik_ids.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Izabrano: {form.radnik_ids.length} {form.radnik_ids.length === 1 ? "radnik" : "radnika"}
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn" disabled={adding}>
          {adding ? "Dodavanje…" : "Dodaj fazu"}
        </button>
      </form>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div className="fazeFormTitle" style={{ marginBottom: 0 }}>Lista faza</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 13, padding: "6px 12px", opacity: viewTab === "tabela" ? 1 : 0.6 }}
              onClick={() => setViewTab("tabela")}
            >
              Tabela
            </button>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 13, padding: "6px 12px", opacity: viewTab === "timeline" ? 1 : 0.6 }}
              onClick={() => setViewTab("timeline")}
            >
              Timeline
            </button>
          </div>
        </div>

        {viewTab === "tabela" && (
        <div className="table-wrap">
          <table className="fazeTable">
            <thead>
              <tr>
                <th>Tip / Naziv</th>
                <th>Početak</th>
                <th>Kraj</th>
                <th>Deadline</th>
                <th>%</th>
                <th>Dobavljači</th>
                <th>Radnici</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faze.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    Nema faza. Dodaj prvu fazu iznad.
                  </td>
                </tr>
              )}
              {faze.map((f) => (
                <tr key={`${f.projekat_faza_id}-${f.procenat_izvrsenosti}`}>
                  <td>
                    {f.faza_naziv || f.naziv || "—"}
                    {f.naziv && f.faza_naziv && ` (${f.naziv})`}
                  </td>
                  <td>{fmtDate(f.datum_pocetka)}</td>
                  <td>{fmtDate(f.datum_kraja)}</td>
                  <td>{fmtDate(f.deadline)}</td>
                  <td>
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
                  </td>
                  <td>
                    {f.dobavljaci?.length ? f.dobavljaci.map((d) => d.naziv).join(", ") : "—"}
                  </td>
                  <td>
                    {f.radnici?.length ? f.radnici.map((r) => `${r.ime} ${r.prezime}`).join(", ") : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12, padding: "4px 8px" }}
                      onClick={() => handleDelete(f.projekat_faza_id)}
                      title="Obriši"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {viewTab === "timeline" && <FazeGantt faze={faze} />}
      </div>
    </div>
  );
}
