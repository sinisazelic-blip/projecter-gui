"use client";

import { useMemo, useState } from "react";
import type { OpsArtikal, OpsArtikalVrsta, OpsJm, OpsMagacin } from "@/lib/ops/schema";

type Catalog = {
  jedinice: OpsJm[];
  magacini: OpsMagacin[];
  artikli: OpsArtikal[];
};

export default function ArtikliClient({ initial }: { initial: Catalog }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"ALL" | OpsArtikalVrsta>("ALL");
  const [form, setForm] = useState({
    sifra: "",
    naziv: "",
    vrsta: "MATERIJAL" as OpsArtikalVrsta,
    jm_id: String(initial.jedinice[0]?.jm_id ?? ""),
  });

  const rows = useMemo(() => {
    if (filter === "ALL") return data.artikli;
    return data.artikli.filter((a) => a.vrsta === filter);
  }, [data.artikli, filter]);

  async function refreshFrom(res: Response) {
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Greška");
    setData({
      jedinice: json.jedinice,
      magacini: json.magacini,
      artikli: json.artikli,
    });
  }

  async function createArtikal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sifra: form.sifra,
          naziv: form.naziv,
          vrsta: form.vrsta,
          jm_id: Number(form.jm_id),
        }),
      });
      await refreshFrom(res);
      setForm((f) => ({ ...f, sifra: "", naziv: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: OpsArtikal) {
    setError(null);
    try {
      const res = await fetch("/api/ops/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikal_id: row.artikal_id,
          aktivan: row.aktivan ? 0 : 1,
        }),
      });
      await refreshFrom(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      {error ? (
        <p style={{ color: "var(--danger)" }}>{error}</p>
      ) : null}
      <form
        onSubmit={(e) => void createArtikal(e)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Šifra
          <input
            value={form.sifra}
            onChange={(e) => setForm((f) => ({ ...f, sifra: e.target.value }))}
            required
            style={{ padding: 8, minWidth: 140 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Naziv
          <input
            value={form.naziv}
            onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
            required
            style={{ padding: 8, minWidth: 240 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Vrsta
          <select
            value={form.vrsta}
            onChange={(e) =>
              setForm((f) => ({ ...f, vrsta: e.target.value as OpsArtikalVrsta }))
            }
            style={{ padding: 8 }}
          >
            <option value="MATERIJAL">Materijal (M1)</option>
            <option value="OPREMA">Oprema (M2)</option>
            <option value="SABLON">Sablon kompleta (M2)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          JM
          <select
            value={form.jm_id}
            onChange={(e) => setForm((f) => ({ ...f, jm_id: e.target.value }))}
            style={{ padding: 8 }}
          >
            {data.jedinice.map((j) => (
              <option key={j.jm_id} value={j.jm_id}>
                {j.oznaka}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Snimanje…" : "Dodaj"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["ALL", "MATERIJAL", "OPREMA", "SABLON"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className="btn"
            onClick={() => setFilter(f)}
            style={{
              fontWeight: filter === f ? 700 : 500,
              background: filter === f ? "rgba(56,189,248,0.16)" : undefined,
            }}
          >
            {f === "ALL" ? "Sve" : f}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--panel)",
          }}
        >
          <thead>
            <tr>
              {["Šifra", "Naziv", "Vrsta", "JM", "Magacin", "Aktivan"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.artikal_id}>
                <td style={{ padding: "8px 10px" }}>
                  <code>{row.sifra}</code>
                </td>
                <td style={{ padding: "8px 10px" }}>{row.naziv}</td>
                <td style={{ padding: "8px 10px" }}>{row.vrsta}</td>
                <td style={{ padding: "8px 10px" }}>{row.jm_oznaka}</td>
                <td style={{ padding: "8px 10px" }}>{row.magacin_kod}</td>
                <td style={{ padding: "8px 10px" }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => void toggleActive(row)}
                  >
                    {row.aktivan ? "Da" : "Ne"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
