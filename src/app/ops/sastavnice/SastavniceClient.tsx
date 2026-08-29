"use client";

import { useMemo, useState } from "react";
import type { OpsArtikal, OpsSastavnicaLinija } from "@/lib/ops/schema";

type Catalog = {
  artikli: OpsArtikal[];
  sastavnice: OpsSastavnicaLinija[];
};

export default function SastavniceClient({ initial }: { initial: Catalog }) {
  const sabloni = initial.artikli.filter((a) => a.vrsta === "SABLON");
  const [sablonId, setSablonId] = useState<number>(sabloni[0]?.artikal_id ?? 0);
  const [lines, setLines] = useState<OpsSastavnicaLinija[]>(
    initial.sastavnice.filter((s) => s.sablon_artikal_id === (sabloni[0]?.artikal_id ?? 0)),
  );
  const [pickId, setPickId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [artikli, setArtikli] = useState(initial.artikli);

  const components = useMemo(
    () => artikli.filter((a) => a.vrsta !== "SABLON" && a.aktivan),
    [artikli],
  );

  function loadSablon(id: number, allLines: OpsSastavnicaLinija[]) {
    setSablonId(id);
    setLines(allLines.filter((s) => s.sablon_artikal_id === id));
  }

  function addLine() {
    const kid = Number(pickId);
    const kolicina = Number(qty.replace(",", "."));
    if (!kid || !(kolicina > 0)) return;
    const art = artikli.find((a) => a.artikal_id === kid);
    if (!art) return;
    setLines((prev) => {
      const rest = prev.filter((l) => l.komponenta_artikal_id !== kid);
      return [
        ...rest,
        {
          sablon_artikal_id: sablonId,
          komponenta_artikal_id: kid,
          kolicina,
          komponenta_sifra: art.sifra,
          komponenta_naziv: art.naziv,
          komponenta_jm: art.jm_oznaka,
        },
      ];
    });
    setPickId("");
    setQty("1");
  }

  async function save() {
    if (!sablonId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sablon_artikal_id: sablonId,
          lines: lines.map((l) => ({
            komponenta_artikal_id: l.komponenta_artikal_id,
            kolicina: l.kolicina,
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Greška");
      setArtikli(json.artikli);
      loadSablon(sablonId, json.sastavnice);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      <p style={{ fontSize: 13, opacity: 0.8, maxWidth: 640 }}>
        Radni nalog (P3) neće moći bez sastavnice. Ovdje se vidi da TTS zona
        skida 7 dijelova, a Cat6 ide u metrima.
      </p>
      <label style={{ display: "grid", gap: 4, fontSize: 12, maxWidth: 360, marginBottom: 16 }}>
        Sablon
        <select
          value={sablonId}
          onChange={(e) => {
            const id = Number(e.target.value);
            fetch("/api/ops/catalog")
              .then((r) => r.json())
              .then((j) => {
                if (j.ok) loadSablon(id, j.sastavnice);
                else setSablonId(id);
              })
              .catch(() => setSablonId(id));
          }}
          style={{ padding: 8 }}
        >
          {sabloni.map((s) => (
            <option key={s.artikal_id} value={s.artikal_id}>
              {s.sifra} — {s.naziv}
            </option>
          ))}
        </select>
      </label>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          background: "var(--panel)",
          marginBottom: 12,
        }}
      >
        <thead>
          <tr>
            {["Šifra", "Naziv", "Količina", "JM", ""].map((h) => (
              <th
                key={h || "x"}
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
          {lines.map((l) => (
            <tr key={l.komponenta_artikal_id}>
              <td style={{ padding: "8px 10px" }}>
                <code>{l.komponenta_sifra}</code>
              </td>
              <td style={{ padding: "8px 10px" }}>{l.komponenta_naziv}</td>
              <td style={{ padding: "8px 10px" }}>{l.kolicina}</td>
              <td style={{ padding: "8px 10px" }}>{l.komponenta_jm}</td>
              <td style={{ padding: "8px 10px" }}>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    setLines((prev) =>
                      prev.filter(
                        (x) => x.komponenta_artikal_id !== l.komponenta_artikal_id,
                      ),
                    )
                  }
                >
                  Ukloni
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Komponenta
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            style={{ padding: 8, minWidth: 280 }}
          >
            <option value="">—</option>
            {components.map((c) => (
              <option key={c.artikal_id} value={c.artikal_id}>
                {c.sifra} — {c.naziv} ({c.jm_oznaka})
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          Količina
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ padding: 8, width: 90 }}
          />
        </label>
        <button type="button" className="btn" onClick={addLine}>
          Dodaj u BOM
        </button>
        <button type="button" className="btn" disabled={saving} onClick={() => void save()}>
          {saving ? "Snimanje…" : "Sačuvaj sastavnicu"}
        </button>
      </div>
    </div>
  );
}
