"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  stavka_id: number | null;
  naziv: string;
  jedinica: string;
  cijena_default: number | string;
  valuta_default: string;
  sort_order?: number | null;
  active: number | boolean;
  created_at?: string | null;
  updated_at?: string | null;

  // client-only
  _tmpId?: string;
  _dirty?: boolean;
  _isNew?: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  outline: "none",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDT(v?: string | null) {
  if (!v) return "—";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normCcy(v: any) {
  const s = String(v ?? "").trim().toUpperCase();
  return (s || "BAM").slice(0, 3);
}

function asNumber(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function CjenovnikPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/cjenovnik", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška (cjenovnik)");
      const list = Array.isArray(data.rows) ? (data.rows as Row[]) : [];
      setRows(
        list.map((r) => ({
          ...r,
          valuta_default: normCcy(r.valuta_default),
          active: Number(r.active ?? 0) ? 1 : 0,
          _dirty: false,
          _isNew: false,
        }))
      );
    } catch (e: any) {
      setErr(e?.message ?? "Greška");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirtyCount = useMemo(() => rows.filter((r) => r._dirty).length, [rows]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        const k = r.stavka_id ? `id:${r.stavka_id}` : `tmp:${r._tmpId}`;
        if (k !== key) return r;
        return { ...r, ...patch, _dirty: true };
      })
    );
  }

  function addNewRow() {
    setMsg(null);
    setErr(null);

    const tmp = `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const r: Row = {
      stavka_id: null,
      _tmpId: tmp,
      _dirty: true,
      _isNew: true,

      naziv: "",
      jedinica: "",
      cijena_default: "",
      valuta_default: "BAM",
      active: 1,

      created_at: null,
      updated_at: null,
    };

    setRows((prev) => [r, ...prev]);
  }

  async function saveAll() {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const dirty = rows.filter((r) => r._dirty);

      if (dirty.length === 0) {
        setMsg("Nema promjena za snimiti.");
        setSaving(false);
        return;
      }

      // priprema payload + minimalna validacija
      const items = dirty.map((r) => ({
        stavka_id: r.stavka_id,
        naziv: String(r.naziv ?? "").trim(),
        jedinica: String(r.jedinica ?? "").trim(),
        cijena_default: asNumber(r.cijena_default),
        valuta_default: normCcy(r.valuta_default),
        active: !!Number(r.active ?? 0),
      }));

      // ako nešto fali — odmah signal (ne prekidamo sve, ali upozorimo)
      const bad = items.some((i) => !i.naziv || !i.jedinica || i.cijena_default === null);
      if (bad) {
        throw new Error("Ne mogu snimiti: svaka stavka mora imati Naziv, Jedinicu i Cijenu (broj).");
      }

      const res = await fetch("/api/cjenovnik", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Greška pri snimanju.");

      setMsg(`Sačuvano: ${Number(data?.saved ?? items.length)} stavki.`);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Greška");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    try {
      router.back();
      // ako nema history, fallback:
      setTimeout(() => router.push("/inicijacije"), 50);
    } catch {
      router.push("/inicijacije");
    }
  }

  return (
    <div className="container">
      <style>{`
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .glassbtn {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          color: inherit;
        }
        .glassbtn:hover {
          background: rgba(255,255,255,.09);
          border-color: rgba(255,255,255,.26);
        }
        .glassbtn:active { transform: scale(.985); }
        .btn {
          padding: 10px 12px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 650;
          white-space: nowrap;
        }
        .cardLike {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.05);
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,.14);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 14px;
          margin-top: 12px;
        }
        .muted { opacity: .75; }
        .msgOk { color: #21c55d; }
        .msgErr { color: #ff4d4d; }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table th, .table td {
          text-align: left;
          padding: 10px 8px;
          border-top: 1px solid rgba(255,255,255,.10);
          vertical-align: top;
        }
        .table th { font-weight: 750; opacity: .95; }
        .num { text-align: right; }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.04);
        }
      `}</style>

      {/* HEADER */}
      <div className="topbar">
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Cjenovnik</h1>

          <span className="pill muted" title="Sort po nazivu (A→Z)">
            Stavke: <b style={{ opacity: 1 }}>{rows.length}</b>
          </span>

          <span className="pill muted" title="Nesnimljene promjene">
            Promjene: <b style={{ opacity: 1 }}>{dirtyCount}</b>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="glassbtn btn" onClick={addNewRow} title="Dodaj novu stavku">
            ➕ Dodaj novu cijenu
          </button>

          <button
            type="button"
            className="glassbtn btn"
            onClick={saveAll}
            disabled={saving || loading || dirtyCount === 0}
            style={{ opacity: saving || dirtyCount === 0 ? 0.65 : 1 }}
            title="Snimi promjene"
          >
            💾 {saving ? "Snima..." : "Snimi promjene"}
          </button>

          <button type="button" className="glassbtn btn" onClick={close} title="Zatvori cjenovnik">
            ✖ Zatvori cjenovnik
          </button>
        </div>
      </div>

      {!!err && <div className="cardLike msgErr">Greška: {err}</div>}
      {!!msg && <div className="cardLike msgOk">{msg}</div>}

      {/* TABLE */}
      <div className="cardLike">
        {loading ? (
          <div className="muted">Učitavam…</div>
        ) : rows.length === 0 ? (
          <div className="muted">Nema stavki u cjenovniku.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Naziv</th>
                <th style={{ width: 140 }}>Jedinica</th>
                <th className="num" style={{ width: 150 }}>Cijena</th>
                <th style={{ width: 90 }}>Valuta</th>
                <th style={{ width: 90 }}>Active</th>
                <th style={{ width: 170 }}>Kreirano</th>
                <th style={{ width: 170 }}>Ažurirano</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const key = r.stavka_id ? `id:${r.stavka_id}` : `tmp:${r._tmpId}`;
                const isNew = !!r._isNew;
                const isDirty = !!r._dirty;

                return (
                  <tr key={key} style={{ opacity: Number(r.active) ? 1 : 0.7 }}>
                    <td className="muted">
                      {r.stavka_id ?? (isNew ? "NEW" : "—")}
                      {isDirty ? <div style={{ fontSize: 12, marginTop: 4 }}>✱</div> : null}
                    </td>

                    <td>
                      <input
                        value={r.naziv ?? ""}
                        onChange={(e) => updateRow(key, { naziv: e.target.value })}
                        placeholder="npr. Snimanje talenta za reklamu"
                        style={inputStyle}
                      />
                    </td>

                    <td>
                      <input
                        value={r.jedinica ?? ""}
                        onChange={(e) => updateRow(key, { jedinica: e.target.value })}
                        placeholder="komad / sat / paket"
                        style={inputStyle}
                      />
                    </td>

                    <td className="num">
                      <input
                        value={String(r.cijena_default ?? "")}
                        onChange={(e) => updateRow(key, { cijena_default: e.target.value })}
                        placeholder="0.00"
                        style={{ ...inputStyle, textAlign: "right" }}
                        inputMode="decimal"
                      />
                    </td>

                    <td>
                      <select
                        value={normCcy(r.valuta_default)}
                        onChange={(e) => updateRow(key, { valuta_default: e.target.value })}
                        style={inputStyle}
                      >
                        {["BAM", "EUR", "USD", "RSD"].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={Number(r.active) ? "1" : "0"}
                        onChange={(e) => updateRow(key, { active: e.target.value === "1" ? 1 : 0 })}
                        style={inputStyle}
                        title="Da li je stavka aktuelna?"
                      >
                        <option value="1">DA</option>
                        <option value="0">NE</option>
                      </select>
                    </td>

                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {fmtDT(r.created_at)}
                    </td>

                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {fmtDT(r.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          * Prikaz je sortiran po <b>nazivu (A→Z)</b>. “Active=NE” samo gasi stavku (ne brišemo ništa).
        </div>
      </div>
    </div>
  );
}
