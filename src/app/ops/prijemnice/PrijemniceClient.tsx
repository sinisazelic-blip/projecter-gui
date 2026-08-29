"use client";

import { useState } from "react";
import type { OpsArtikal } from "@/lib/ops/schema";
import type { OpsPrijemnica } from "@/lib/ops/queries";

type Line = { key: string; artikal_id: string; kolicina: string };

export default function PrijemniceClient({
  artikli,
  dobavljaci,
  initialDocs,
}: {
  artikli: OpsArtikal[];
  dobavljaci: Array<{ dobavljac_id: number; naziv: string }>;
  initialDocs: OpsPrijemnica[];
}) {
  const receivable = artikli.filter(
    (a) => a.aktivan && a.vrsta !== "SABLON",
  );
  const today = new Date().toISOString().slice(0, 10);
  const [docs, setDocs] = useState(initialDocs);
  const [datum, setDatum] = useState(today);
  const [dobavljacId, setDobavljacId] = useState("");
  const [dobavljacNaziv, setDobavljacNaziv] = useState("");
  const [racun, setRacun] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: "1", artikal_id: "", kolicina: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ops/prijemnice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum,
          dobavljac_id: dobavljacId ? Number(dobavljacId) : null,
          dobavljac_naziv:
            dobavljaci.find((d) => String(d.dobavljac_id) === dobavljacId)
              ?.naziv || dobavljacNaziv,
          racun,
          lines: lines
            .filter((l) => l.artikal_id && Number(l.kolicina) > 0)
            .map((l) => ({
              artikal_id: Number(l.artikal_id),
              kolicina: Number(String(l.kolicina).replace(",", ".")),
            })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Greška");
      setDocs(json.prijemnice ?? []);
      setLines([{ key: String(Date.now()), artikal_id: "", kolicina: "" }]);
      setRacun("");
      const serije = Array.isArray(json.serije) ? json.serije : [];
      setInfo(
        serije.length
          ? `Prijemnica ${json.broj}. Serije: ${serije.join(", ")}`
          : `Prijemnica ${json.broj} knjižena na stanje.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error ? <p className="opsMsgErr">{error}</p> : null}
      {info ? <p className="opsMsgOk">{info}</p> : null}
      <form onSubmit={(e) => void submit(e)} style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Datum
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              style={{ padding: 8 }}
              required
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Dobavljač
            <select
              value={dobavljacId}
              onChange={(e) => setDobavljacId(e.target.value)}
              style={{ padding: 8, minWidth: 220 }}
            >
              <option value="">— ručni unos —</option>
              {dobavljaci.map((d) => (
                <option key={d.dobavljac_id} value={d.dobavljac_id}>
                  {d.naziv}
                </option>
              ))}
            </select>
          </label>
          {!dobavljacId ? (
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Naziv dobavljača
              <input
                value={dobavljacNaziv}
                onChange={(e) => setDobavljacNaziv(e.target.value)}
                style={{ padding: 8, minWidth: 200 }}
              />
            </label>
          ) : null}
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Račun / carina
            <input
              value={racun}
              onChange={(e) => setRacun(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>
        </div>

        {lines.map((line, idx) => {
          const art = receivable.find(
            (a) => String(a.artikal_id) === line.artikal_id,
          );
          return (
            <div
              key={line.key}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}
            >
              <select
                value={line.artikal_id}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x) =>
                      x.key === line.key ? { ...x, artikal_id: e.target.value } : x,
                    ),
                  )
                }
                style={{ padding: 8, minWidth: 320 }}
              >
                <option value="">— artikal —</option>
                {receivable.map((a) => (
                  <option key={a.artikal_id} value={a.artikal_id}>
                    {a.sifra} — {a.naziv} ({a.vrsta}, {a.jm_oznaka})
                  </option>
                ))}
              </select>
              <input
                placeholder="Količina"
                value={line.kolicina}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x) =>
                      x.key === line.key ? { ...x, kolicina: e.target.value } : x,
                    ),
                  )
                }
                style={{ padding: 8, width: 100 }}
              />
              <span style={{ fontSize: 12, alignSelf: "center", opacity: 0.75 }}>
                {art?.vrsta === "OPREMA"
                  ? "biće nove serije"
                  : art?.jm_oznaka || ""}
              </span>
              {idx === lines.length - 1 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      { key: String(Date.now()), artikal_id: "", kolicina: "" },
                    ])
                  }
                >
                  + stavka
                </button>
              ) : null}
            </div>
          );
        })}
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Knjiženje…" : "Proknjiži prijemnicu"}
        </button>
      </form>

      <h3 style={{ marginTop: 0 }}>Zadnje prijemnice</h3>
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
            {["Broj", "Datum", "Dobavljač", "Račun"].map((h) => (
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
          {docs.map((d) => (
            <tr key={d.prijemnica_id}>
              <td style={{ padding: "8px 10px" }}>{d.broj}</td>
              <td style={{ padding: "8px 10px" }}>
                {String(d.datum).slice(0, 10).split("-").reverse().join(".")}
              </td>
              <td style={{ padding: "8px 10px" }}>{d.dobavljac_naziv || "—"}</td>
              <td style={{ padding: "8px 10px" }}>{d.racun || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
