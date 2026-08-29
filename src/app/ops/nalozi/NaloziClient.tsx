"use client";

import { useMemo, useState } from "react";
import type {
  OpsArtikal,
  OpsJedinicaOpreme,
  OpsRadniNalog,
  OpsSastavnicaLinija,
  OpsStanje,
} from "@/lib/ops/schema";

function fmtQty(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

export default function NaloziClient({
  artikli,
  sastavnice,
  stanje,
  jediniceOpreme,
  radnici,
  initialDocs,
}: {
  artikli: OpsArtikal[];
  sastavnice: OpsSastavnicaLinija[];
  stanje: OpsStanje[];
  jediniceOpreme: OpsJedinicaOpreme[];
  radnici: Array<{ radnik_id: number; naziv: string }>;
  initialDocs: OpsRadniNalog[];
}) {
  const sabloni = artikli.filter((a) => a.aktivan && a.vrsta === "SABLON");
  const today = new Date().toISOString().slice(0, 10);
  const [docs, setDocs] = useState(initialDocs);
  const [stock, setStock] = useState(stanje);
  const [units, setUnits] = useState(jediniceOpreme);
  const [datum, setDatum] = useState(today);
  const [sablonId, setSablonId] = useState(String(sabloni[0]?.artikal_id ?? ""));
  const [kolicina, setKolicina] = useState("1");
  const [sati, setSati] = useState("");
  const [radnikId, setRadnikId] = useState("");
  const [radnikNaziv, setRadnikNaziv] = useState("");
  const [napomena, setNapomena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const qty = Math.max(0, Math.round(Number(String(kolicina).replace(",", ".")) || 0));
  const bom = useMemo(
    () =>
      sastavnice.filter((s) => String(s.sablon_artikal_id) === sablonId),
    [sastavnice, sablonId],
  );

  const preview = bom.map((line) => {
    const art = artikli.find((a) => a.artikal_id === line.komponenta_artikal_id);
    const need = Number(line.kolicina) * qty;
    const have =
      art?.vrsta === "OPREMA"
        ? units.filter(
            (u) =>
              u.artikal_id === line.komponenta_artikal_id &&
              u.stanje === "U_MAGACINU",
          ).length
        : stock
            .filter((s) => s.artikal_id === line.komponenta_artikal_id)
            .reduce((acc, s) => acc + Number(s.kolicina), 0);
    return {
      ...line,
      need,
      have,
      ok: have + 1e-9 >= need && need > 0,
      jm: line.komponenta_jm || (art?.vrsta === "OPREMA" ? "kom" : ""),
    };
  });
  const canClose = bom.length > 0 && qty >= 1 && preview.every((p) => p.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ops/nalozi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum,
          sablon_artikal_id: Number(sablonId),
          kolicina: qty,
          sati: sati ? Number(String(sati).replace(",", ".")) : null,
          radnik_id: radnikId ? Number(radnikId) : null,
          radnik_naziv:
            radnici.find((r) => String(r.radnik_id) === radnikId)?.naziv ||
            radnikNaziv,
          napomena,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        const code = String(json.error || "Greška");
        const map: Record<string, string> = {
          BOM_REQUIRED: "Sastavnica je prazna — nalog se ne otvara.",
          KO_ZATVORIO: "Ko je zatvorio nalog?",
          KOLICINA_CIJELI: "Količina gotovog mora biti cijeli broj.",
          SABLON_REQUIRED: "Izaberi sablon.",
          SABLON_INVALID: "Sablon nije aktivan.",
          DATUM_REQUIRED: "Datum je obavezan.",
        };
        throw new Error(map[code] || code);
      }
      setDocs(json.nalozi ?? []);
      setKolicina("1");
      setSati("");
      setNapomena("");
      const serije = Array.isArray(json.serije) ? json.serije : [];
      setInfo(
        `Nalog ${json.broj} zatvoren. Serije: ${serije.join(", ") || "—"}`,
      );
      const cat = await fetch("/api/ops/catalog");
      const catJson = await cat.json();
      if (catJson.ok) {
        setStock(catJson.stanje ?? []);
        setUnits(catJson.jediniceOpreme ?? []);
      }
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
            Sablon
            <select
              value={sablonId}
              onChange={(e) => setSablonId(e.target.value)}
              style={{ padding: 8, minWidth: 280 }}
            >
              {sabloni.map((a) => (
                <option key={a.artikal_id} value={a.artikal_id}>
                  {a.sifra} — {a.naziv}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Komada
            <input
              value={kolicina}
              onChange={(e) => setKolicina(e.target.value)}
              style={{ padding: 8, width: 80 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Sati rada
            <input
              value={sati}
              onChange={(e) => setSati(e.target.value)}
              placeholder="opciono"
              style={{ padding: 8, width: 90 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Zatvorio
            <select
              value={radnikId}
              onChange={(e) => setRadnikId(e.target.value)}
              style={{ padding: 8, minWidth: 200 }}
            >
              <option value="">— ručni unos —</option>
              {radnici.map((r) => (
                <option key={r.radnik_id} value={r.radnik_id}>
                  {r.naziv}
                </option>
              ))}
            </select>
          </label>
          {!radnikId ? (
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Ime
              <input
                value={radnikNaziv}
                onChange={(e) => setRadnikNaziv(e.target.value)}
                style={{ padding: 8, minWidth: 160 }}
                required
              />
            </label>
          ) : null}
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Napomena
            <input
              value={napomena}
              onChange={(e) => setNapomena(e.target.value)}
              style={{ padding: 8, minWidth: 180 }}
            />
          </label>
        </div>

        <h3 style={{ margin: "8px 0 10px" }}>Sastavnica × {qty || 0}</h3>
        {!bom.length ? (
          <p style={{ color: "var(--danger)", fontSize: 13 }}>
            Ovaj sablon nema sastavnicu — nalog se ne otvara.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              background: "var(--panel)",
              marginBottom: 14,
            }}
          >
            <thead>
              <tr>
                {["Šifra", "Treba", "Na stanju", "JM"].map((h) => (
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
              {preview.map((p) => (
                <tr key={p.komponenta_artikal_id}>
                  <td style={{ padding: "8px 10px" }}>
                    {p.komponenta_sifra}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{fmtQty(p.need)}</td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: p.ok ? "#86efac" : "var(--danger)",
                      fontWeight: 700,
                    }}
                  >
                    {fmtQty(p.have)}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{p.jm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button type="submit" className="btn" disabled={saving || !canClose}>
          {saving ? "Knjiženje…" : "Zatvori radni nalog"}
        </button>
        {!canClose && bom.length ? (
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>
            Prvo dopuni M1 prijemnicom.
          </span>
        ) : null}
      </form>

      <h3 style={{ marginTop: 0 }}>Zadnji nalozi</h3>
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
            {["Broj", "Datum", "Sablon", "Kom.", "Sati", "Zatvorio", "Serije"].map(
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
          {docs.map((d) => (
            <tr key={d.rn_id}>
              <td style={{ padding: "8px 10px" }}>{d.broj}</td>
              <td style={{ padding: "8px 10px" }}>
                {String(d.datum).slice(0, 10).split("-").reverse().join(".")}
              </td>
              <td style={{ padding: "8px 10px" }}>{d.sablon_sifra}</td>
              <td style={{ padding: "8px 10px" }}>{d.kolicina}</td>
              <td style={{ padding: "8px 10px" }}>{d.sati ?? "—"}</td>
              <td style={{ padding: "8px 10px" }}>{d.radnik_naziv || "—"}</td>
              <td style={{ padding: "8px 10px", fontSize: 12 }}>
                {(d.serije ?? []).join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
