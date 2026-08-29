"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  OpsHaasCijena,
  OpsHaasFaktura,
  OpsHaasStavka,
  OpsKompletacija,
} from "@/lib/ops/schema";

const ERR: Record<string, string> = {
  VEC_FAKTURISANO: "Ovaj event je već na fakturi.",
  NEMA_KOMADA: "Na eventu nema skeniranih komada.",
  CIJENA_REQUIRED: "Svaka stavka mora imati cijenu najma (HaaS, ne SaaS).",
  KLIJENT_REQUIRED: "Izaberi naručioca koji plaća.",
  NARUCILAC_REQUIRED: "Faktura ide na naručioca, ne na krajnjeg klijenta.",
  DATUM_REQUIRED: "Datum je obavezan.",
  KOMPLETACIJA_INVALID: "Event nije pronađen.",
};

export default function HaasClient({
  initialCjenovnik,
  initialFakture,
  kompletacije,
  klijenti,
}: {
  initialCjenovnik: OpsHaasCijena[];
  initialFakture: OpsHaasFaktura[];
  kompletacije: OpsKompletacija[];
  klijenti: Array<{ klijent_id: number; naziv: string; is_narucilac?: number }>;
}) {
  const narucioci = klijenti.filter((k) => Number(k.is_narucilac) === 1);
  const openEvents = kompletacije.filter((e) => !e.faktura_id);
  const today = new Date().toISOString().slice(0, 10);
  const [cjenovnik, setCjenovnik] = useState(initialCjenovnik);
  const [fakture, setFakture] = useState(initialFakture);
  const [prices, setPrices] = useState<Record<number, { bam: string; eur: string }>>(
    () =>
      Object.fromEntries(
        initialCjenovnik.map((c) => [
          c.artikal_id,
          { bam: String(c.cijena_bam || ""), eur: String(c.cijena_eur || "") },
        ]),
      ),
  );
  const [komplId, setKomplId] = useState(String(openEvents[0]?.kompletacija_id ?? ""));
  const [klijentId, setKlijentId] = useState(
    String(
      openEvents[0]?.klijent_id ??
        narucioci[0]?.klijent_id ??
        "",
    ),
  );
  const [datum, setDatum] = useState(today);
  const [valuta, setValuta] = useState<"BAM" | "EUR">("BAM");
  const [vat, setVat] = useState<"BH_17" | "INO_0">("BH_17");
  const [preview, setPreview] = useState<{
    event: { broj: string; event_naziv: string; klasa_rizika: string };
    lines: OpsHaasStavka[];
    osnovica: number;
  } | null>(null);
  const [linePrices, setLinePrices] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveCjenovnik(row: OpsHaasCijena) {
    setError(null);
    const p = prices[row.artikal_id];
    const res = await fetch("/api/ops/haas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artikal_id: row.artikal_id,
        cijena_bam: Number(String(p?.bam ?? "0").replace(",", ".")),
        cijena_eur: Number(String(p?.eur ?? "0").replace(",", ".")),
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(ERR[json.error] || json.error);
      return;
    }
    setCjenovnik(json.cjenovnik);
    setInfo(`Cijena za ${row.sifra} snimljena.`);
  }

  async function loadPreview() {
    if (!komplId) return;
    setError(null);
    setInfo(null);
    const res = await fetch(
      `/api/ops/haas?kompletacija_id=${komplId}&valuta=${valuta}`,
    );
    const json = await res.json();
    if (!json.ok) {
      setPreview(null);
      setError(ERR[json.error] || json.error);
      return;
    }
    setPreview(json.preview);
    setLinePrices(
      Object.fromEntries(
        (json.preview?.lines ?? []).map((l: OpsHaasStavka) => [
          l.artikal_id,
          String(l.cijena || ""),
        ]),
      ),
    );
    const ev = kompletacije.find((e) => String(e.kompletacija_id) === komplId);
    if (ev?.klijent_id) setKlijentId(String(ev.klijent_id));
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/ops/haas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kompletacija_id: Number(komplId),
          klijent_id: Number(klijentId),
          datum,
          valuta,
          vat,
          lines: preview.lines.map((l) => ({
            artikal_id: l.artikal_id,
            cijena: Number(String(linePrices[l.artikal_id] ?? l.cijena).replace(",", ".")),
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setFakture(json.fakture ?? []);
      setPreview(null);
      setInfo(`HaaS faktura ${json.broj_fakture} kreirana.`);
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

      <h3 style={{ margin: "0 0 8px" }}>Cjenovnik najma (nije SaaS)</h3>
      <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>
        Cijena po komadu po eventu. EnterSYS licence ovdje ne postoje.
      </p>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          background: "var(--panel)",
          marginBottom: 28,
        }}
      >
        <thead>
          <tr>
            {["Šifra", "Naziv", "KM / event", "EUR / event", ""].map((h) => (
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
          {cjenovnik.map((c) => (
            <tr key={c.artikal_id}>
              <td style={{ padding: "8px 10px", fontWeight: 700 }}>{c.sifra}</td>
              <td style={{ padding: "8px 10px" }}>{c.naziv}</td>
              <td style={{ padding: "8px 10px" }}>
                <input
                  value={prices[c.artikal_id]?.bam ?? ""}
                  onChange={(e) =>
                    setPrices((p) => ({
                      ...p,
                      [c.artikal_id]: { ...p[c.artikal_id], bam: e.target.value },
                    }))
                  }
                  style={{ padding: 6, width: 90 }}
                />
              </td>
              <td style={{ padding: "8px 10px" }}>
                <input
                  value={prices[c.artikal_id]?.eur ?? ""}
                  onChange={(e) =>
                    setPrices((p) => ({
                      ...p,
                      [c.artikal_id]: { ...p[c.artikal_id], eur: e.target.value },
                    }))
                  }
                  style={{ padding: 6, width: 90 }}
                />
              </td>
              <td style={{ padding: "8px 10px" }}>
                <button type="button" className="btn" onClick={() => void saveCjenovnik(c)}>
                  Snimi
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: "0 0 8px" }}>Fakturiši komplet</h3>
      <form onSubmit={(e) => void issue(e)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <select
            value={komplId}
            onChange={(e) => {
              const id = e.target.value;
              setKomplId(id);
              const ev = kompletacije.find((x) => String(x.kompletacija_id) === id);
              if (ev?.klijent_id) setKlijentId(String(ev.klijent_id));
            }}
            style={{ padding: 8, minWidth: 280 }}
          >
            <option value="">— event —</option>
            {openEvents.map((ev) => (
              <option key={ev.kompletacija_id} value={ev.kompletacija_id}>
                {ev.broj} · {ev.event_naziv}
                {ev.klijent_naziv
                  ? ` · ${ev.klijent_naziv}${ev.krajnji_klijent_naziv ? ` → ${ev.krajnji_klijent_naziv}` : ""}`
                  : ""}{" "}
                · {ev.status}
              </option>
            ))}
          </select>
          <select
            value={klijentId}
            onChange={(e) => setKlijentId(e.target.value)}
            style={{ padding: 8, minWidth: 200 }}
            required
          >
            <option value="">— naručilac (plaća) —</option>
            {narucioci.map((k) => (
              <option key={k.klijent_id} value={k.klijent_id}>
                {k.naziv}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            style={{ padding: 8 }}
          />
          <select
            value={valuta}
            onChange={(e) => setValuta(e.target.value as "BAM" | "EUR")}
            style={{ padding: 8 }}
          >
            <option value="BAM">KM</option>
            <option value="EUR">EUR</option>
          </select>
          <select
            value={vat}
            onChange={(e) => setVat(e.target.value as "BH_17" | "INO_0")}
            style={{ padding: 8 }}
          >
            <option value="BH_17">PDV 17%</option>
            <option value="INO_0">INO 0%</option>
          </select>
          <button type="button" className="btn" onClick={() => void loadPreview()}>
            Prikaži stavke
          </button>
        </div>

        {preview ? (
          <>
            <p style={{ fontSize: 13 }}>
              {preview.event.broj} · {preview.event.event_naziv} ·{" "}
              {preview.event.klasa_rizika}
            </p>
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
                  {["Šifra", "Kom.", "Cijena najma", "Serije"].map((h) => (
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
                {preview.lines.map((l) => (
                  <tr key={l.artikal_id}>
                    <td style={{ padding: "8px 10px" }}>
                      {l.sifra} — {l.naziv}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{l.kolicina}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        value={linePrices[l.artikal_id] ?? ""}
                        onChange={(e) =>
                          setLinePrices((p) => ({
                            ...p,
                            [l.artikal_id]: e.target.value,
                          }))
                        }
                        style={{ padding: 6, width: 90 }}
                      />
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>
                      {l.serije.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Knjiženje…" : "Izdaj HaaS fakturu"}
            </button>
          </>
        ) : null}
      </form>

      <h3 style={{ margin: "28px 0 8px" }}>Izdane HaaS fakture</h3>
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
            {["Broj", "Event", "Klijent", "Osnovica", ""].map((h) => (
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
          {fakture.map((f) => (
            <tr key={f.haas_faktura_id}>
              <td style={{ padding: "8px 10px" }}>{f.broj_fakture || f.faktura_id}</td>
              <td style={{ padding: "8px 10px" }}>{f.event_naziv}</td>
              <td style={{ padding: "8px 10px" }}>{f.klijent_naziv || "—"}</td>
              <td style={{ padding: "8px 10px" }}>
                {Number(f.osnovica).toFixed(2)} {f.valuta === "EUR" ? "EUR" : "KM"}
              </td>
              <td style={{ padding: "8px 10px" }}>
                <Link href={`/ops/haas/${f.faktura_id}`} className="btn">
                  Pregled
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
