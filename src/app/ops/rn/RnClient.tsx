"use client";

import { useState } from "react";
import { ENTERSYS_MODULE_KEYS } from "@/lib/entersys-activation";
import type { OpsArtikal, OpsRnPosao, OpsRnSpec } from "@/lib/ops/schema";

type RnRow = OpsRnPosao & { spec: OpsRnSpec[]; saas: string[] };
type SpecLine = { key: string; artikal_id: string; kolicina: string };

const ERR: Record<string, string> = {
  PROJEKAT_REQUIRED: "Izaberi posao.",
  PROJEKAT_INVALID: "Taj posao ne postoji.",
  DATUM_REQUIRED: "Datum je obavezan.",
};

export default function RnClient({
  projekti,
  artikli,
  radnici,
  initialNalozi,
}: {
  projekti: Array<{
    projekat_id: number;
    naziv: string;
    narucilac_naziv?: string | null;
    krajnji_naziv?: string | null;
  }>;
  artikli: OpsArtikal[];
  radnici: Array<{ radnik_id: number; naziv: string }>;
  initialNalozi: RnRow[];
}) {
  const oprema = artikli.filter(
    (a) => a.aktivan && (a.vrsta === "OPREMA" || a.vrsta === "SABLON"),
  );
  const today = new Date().toISOString().slice(0, 10);
  const [nalozi, setNalozi] = useState(initialNalozi);
  const [projekatId, setProjekatId] = useState("");
  const [datum, setDatum] = useState(today);
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [objekat, setObjekat] = useState("");
  const [voditeljId, setVoditeljId] = useState("");
  const [voditeljNaziv, setVoditeljNaziv] = useState("");
  const [napomena, setNapomena] = useState("");
  const [saas, setSaas] = useState<string[]>([]);
  const [spec, setSpec] = useState<SpecLine[]>([
    { key: "1", artikal_id: "", kolicina: "1" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickJob(id: string) {
    setProjekatId(id);
    const job = projekti.find((p) => String(p.projekat_id) === id);
    if (job?.krajnji_naziv) setObjekat((prev) => prev || job.krajnji_naziv || "");
  }

  function toggleSaas(key: string) {
    setSaas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ops/nalozi-posla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projekat_id: Number(projekatId),
          datum,
          objekat,
          voditelj_naziv:
            radnici.find((r) => String(r.radnik_id) === voditeljId)?.naziv ||
            voditeljNaziv,
          datum_od: datumOd || null,
          datum_do: datumDo || null,
          napomena,
          saas,
          spec: spec
            .filter((l) => l.artikal_id && Number(l.kolicina) > 0)
            .map((l) => ({
              artikal_id: Number(l.artikal_id),
              kolicina: Math.round(Number(String(l.kolicina).replace(",", "."))),
            })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setNalozi(json.nalozi ?? []);
      setSpec([{ key: String(Date.now()), artikal_id: "", kolicina: "1" }]);
      setSaas([]);
      setNapomena("");
      setInfo(`Radni nalog ${json.broj} otvoren.`);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      setError(ERR[code] || code);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error ? <p className="opsMsgErr">{error}</p> : null}
      {info ? <p className="opsMsgOk">{info}</p> : null}

      <form onSubmit={(e) => void submit(e)} style={{ marginBottom: 28 }}>
        <h3 style={{ margin: "0 0 10px" }}>Novi radni nalog</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Posao
            <select
              value={projekatId}
              onChange={(e) => pickJob(e.target.value)}
              style={{ padding: 8, minWidth: 260 }}
              required
            >
              <option value="">— posao —</option>
              {projekti.map((p) => (
                <option key={p.projekat_id} value={p.projekat_id}>
                  #{p.projekat_id} {p.naziv}
                  {p.narucilac_naziv
                    ? ` · ${p.narucilac_naziv}${p.krajnji_naziv && p.krajnji_naziv !== p.narucilac_naziv ? ` → ${p.krajnji_naziv}` : ""}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
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
            Od
            <input
              type="date"
              value={datumOd}
              onChange={(e) => setDatumOd(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Do
            <input
              type="date"
              value={datumDo}
              onChange={(e) => setDatumDo(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Objekat
            <input
              value={objekat}
              onChange={(e) => setObjekat(e.target.value)}
              placeholder="gdje se radi"
              style={{ padding: 8, minWidth: 180 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Voditelj
            <select
              value={voditeljId}
              onChange={(e) => setVoditeljId(e.target.value)}
              style={{ padding: 8, minWidth: 180 }}
            >
              <option value="">— ručni unos —</option>
              {radnici.map((r) => (
                <option key={r.radnik_id} value={r.radnik_id}>
                  {r.naziv}
                </option>
              ))}
            </select>
          </label>
          {!voditeljId ? (
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Ime voditelja
              <input
                value={voditeljNaziv}
                onChange={(e) => setVoditeljNaziv(e.target.value)}
                style={{ padding: 8, minWidth: 160 }}
              />
            </label>
          ) : null}
        </div>

        <h4 style={{ margin: "8px 0" }}>SaaS moduli na poslu</h4>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          {ENTERSYS_MODULE_KEYS.map((m) => (
            <label key={m.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={saas.includes(m.key)}
                onChange={() => toggleSaas(m.key)}
              />
              {m.label}
            </label>
          ))}
        </div>

        <h4 style={{ margin: "8px 0" }}>Spec opreme (M2)</h4>
        {spec.map((line, idx) => (
          <div
            key={line.key}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}
          >
            <select
              value={line.artikal_id}
              onChange={(e) =>
                setSpec((prev) =>
                  prev.map((x) =>
                    x.key === line.key ? { ...x, artikal_id: e.target.value } : x,
                  ),
                )
              }
              style={{ padding: 8, minWidth: 320 }}
            >
              <option value="">— oprema / sablon —</option>
              {oprema.map((a) => (
                <option key={a.artikal_id} value={a.artikal_id}>
                  {a.sifra} — {a.naziv}
                  {a.saas_linija ? ` · ${a.saas_linija}` : ""}
                </option>
              ))}
            </select>
            <input
              placeholder="Kom."
              value={line.kolicina}
              onChange={(e) =>
                setSpec((prev) =>
                  prev.map((x) =>
                    x.key === line.key ? { ...x, kolicina: e.target.value } : x,
                  ),
                )
              }
              style={{ padding: 8, width: 80 }}
            />
            {idx === spec.length - 1 ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSpec((prev) => [
                    ...prev,
                    { key: String(Date.now()), artikal_id: "", kolicina: "1" },
                  ])
                }
              >
                + stavka
              </button>
            ) : null}
          </div>
        ))}

        <label style={{ display: "grid", gap: 4, fontSize: 12, margin: "10px 0" }}>
          Napomena
          <input
            value={napomena}
            onChange={(e) => setNapomena(e.target.value)}
            style={{ padding: 8, maxWidth: 480 }}
          />
        </label>
        <button type="submit" className="btn" disabled={saving || !projekatId}>
          {saving ? "Otvaranje…" : "Otvori radni nalog"}
        </button>
      </form>

      <h3 style={{ margin: "0 0 8px" }}>Otvoreni i zadnji nalozi</h3>
      {nalozi.length ? (
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
              {["Broj", "Posao", "Objekat", "Od–do", "Status", "Spec", "SaaS"].map(
                (h) => (
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
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {nalozi.map((r) => (
              <tr key={r.rn_posao_id}>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.broj}</td>
                <td style={{ padding: "8px 10px" }}>
                  #{r.projekat_id} {r.projekat_naziv || ""}
                </td>
                <td style={{ padding: "8px 10px" }}>{r.objekat || "—"}</td>
                <td style={{ padding: "8px 10px" }}>
                  {r.datum_od || r.datum || "—"}
                  {r.datum_do ? ` → ${r.datum_do}` : ""}
                </td>
                <td style={{ padding: "8px 10px" }}>{r.status}</td>
                <td style={{ padding: "8px 10px", fontSize: 12 }}>
                  {r.spec.length
                    ? r.spec.map((s) => `${s.sifra}×${s.kolicina}`).join(", ")
                    : "—"}
                </td>
                <td style={{ padding: "8px 10px", fontSize: 12 }}>
                  {r.saas.length ? r.saas.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Još nema radnih naloga.</p>
      )}
    </div>
  );
}
