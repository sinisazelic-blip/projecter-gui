"use client";

import { useEffect, useState } from "react";

function fmtDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}.${m}.${y}` : s;
}

export default function FazeClient({ projekatId, rokGlavni, radneFaze, radnici }) {
  const [faze, setFaze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState({
    faza_id: "",
    naziv: "",
    datum_pocetka: "",
    datum_kraja: "",
    deadline: "",
    procenat_izvrsenosti: 0,
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
          radnik_ids: form.radnik_ids,
        }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error || "Greška");
      setForm({ faza_id: "", naziv: "", datum_pocetka: "", datum_kraja: "", deadline: "", procenat_izvrsenosti: 0, radnik_ids: [] });
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

  function toggleRadnik(rid) {
    setForm((s) => ({
      ...s,
      radnik_ids: s.radnik_ids.includes(rid)
        ? s.radnik_ids.filter((x) => x !== rid)
        : [...s.radnik_ids, rid],
    }));
  }

  if (loading) return <div className="card" style={{ padding: 24 }}>Učitavanje…</div>;

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
            />
          </div>

          <div className="field">
            <label className="label">Deadline</label>
            <input
              type="date"
              className="input"
              value={form.deadline}
              onChange={(e) => setForm((s) => ({ ...s, deadline: e.target.value }))}
              placeholder={rokGlavni ? `Prazno = ${rokGlavni}` : ""}
            />
          </div>

          <div className="field">
            <label className="label">% izvršenosti</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              value={form.procenat_izvrsenosti}
              onChange={(e) => setForm((s) => ({ ...s, procenat_izvrsenosti: e.target.value }))}
              style={{ width: 80 }}
            />
          </div>

          <div className="field">
            <label className="label">Radnici</label>
            <div className="checkboxGroup">
              {radnici.map((r) => (
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
            </div>
          </div>
        </div>

        <button type="submit" className="btn" disabled={adding}>
          {adding ? "Dodavanje…" : "Dodaj fazu"}
        </button>
      </form>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="fazeFormTitle">Lista faza</div>
        <div className="table-wrap">
          <table className="fazeTable">
            <thead>
              <tr>
                <th>Tip / Naziv</th>
                <th>Početak</th>
                <th>Kraj</th>
                <th>Deadline</th>
                <th>%</th>
                <th>Radnici</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faze.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
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
                      style={{ width: 60, padding: 4 }}
                    />
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
      </div>
    </div>
  );
}
