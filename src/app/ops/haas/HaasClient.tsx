"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpsHaasCijena, OpsHaasFaktura } from "@/lib/ops/schema";

export default function HaasClient({
  initialCjenovnik,
  initialFakture,
}: {
  initialCjenovnik: OpsHaasCijena[];
  initialFakture: OpsHaasFaktura[];
}) {
  const [cjenovnik, setCjenovnik] = useState(initialCjenovnik);
  const [prices, setPrices] = useState<Record<number, { bam: string; eur: string }>>(
    () =>
      Object.fromEntries(
        initialCjenovnik.map((c) => [
          c.artikal_id,
          { bam: String(c.cijena_bam || ""), eur: String(c.cijena_eur || "") },
        ]),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      setError(json.error);
      return;
    }
    setCjenovnik(json.cjenovnik);
    setInfo(`Cijena za ${row.sifra} snimljena.`);
  }

  return (
    <div>
      {error ? <p className="opsMsgErr">{error}</p> : null}
      {info ? <p className="opsMsgOk">{info}</p> : null}

      <div
        style={{
          padding: 14,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--panel)",
          marginBottom: 22,
        }}
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          Račun ide{" "}
          <Link href="/fakture/wizard">wizardom</Link> nakon zatvaranja Deala.
        </p>
      </div>

      <h3 style={{ margin: "0 0 8px" }} title="HaaS, nije SaaS">
        Cjenovnik
      </h3>
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

      {initialFakture.length ? (
        <>
          <h3 style={{ margin: "0 0 8px" }} title="Nove se ne izdaju ovdje">
            Arhiva
          </h3>
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
              {initialFakture.map((f) => (
                <tr key={f.haas_faktura_id}>
                  <td style={{ padding: "8px 10px" }}>
                    {f.broj_fakture || f.faktura_id}
                  </td>
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
        </>
      ) : null}
    </div>
  );
}
