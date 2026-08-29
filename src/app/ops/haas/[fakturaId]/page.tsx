import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEnterPage } from "@/lib/ops/access";
import { getOpsHaasByFaktura } from "@/lib/ops/haas";
import { query } from "@/lib/db";
import { OpsShell } from "../../OpsShell";

export const dynamic = "force-dynamic";

export default async function OpsHaasPreviewPage({
  params,
}: {
  params: Promise<{ fakturaId: string }>;
}) {
  requireEnterPage();
  const fakturaId = Number((await params).fakturaId);
  if (!fakturaId) notFound();
  const haas = await getOpsHaasByFaktura(fakturaId);
  if (!haas) notFound();
  const inv = await query<{
    broj_fakture_puni: string;
    datum_izdavanja: string;
    valuta: string;
    osnovica_km: number;
    pdv_iznos_km: number;
    iznos_ukupno_km: number;
    poziv_na_broj: string | null;
    naziv_klijenta: string | null;
  }>(
    `SELECT f.broj_fakture_puni, f.datum_izdavanja, f.valuta, f.osnovica_km,
            f.pdv_iznos_km, f.iznos_ukupno_km, f.poziv_na_broj, k.naziv_klijenta
     FROM fakture f
     LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
     WHERE f.faktura_id = ?
     LIMIT 1`,
    [fakturaId],
  );
  const f = inv?.[0];
  const ccy = f?.valuta === "EUR" ? "EUR" : "KM";
  return (
    <OpsShell
      title={`HaaS ${f?.broj_fakture_puni ?? fakturaId}`}
      sub={`${haas.event_naziv ?? "Event"} · ${haas.klasa_rizika ?? ""} · najam, nije SaaS`}
    >
      <p style={{ fontSize: 13 }}>
        Klijent: <strong>{f?.naziv_klijenta || "—"}</strong>
        {" · "}
        Datum: {String(f?.datum_izdavanja ?? "").slice(0, 10).split("-").reverse().join(".")}
        {f?.poziv_na_broj ? ` · Poziv: ${f.poziv_na_broj}` : ""}
      </p>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          background: "var(--panel)",
          marginBottom: 16,
        }}
      >
        <thead>
          <tr>
            {["Šifra", "Naziv", "Kom.", "Cijena", "Iznos", "Serije"].map((h) => (
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
          {haas.lines.map((l) => (
            <tr key={l.artikal_id}>
              <td style={{ padding: "8px 10px" }}>{l.sifra}</td>
              <td style={{ padding: "8px 10px" }}>{l.naziv}</td>
              <td style={{ padding: "8px 10px" }}>{l.kolicina}</td>
              <td style={{ padding: "8px 10px" }}>
                {l.cijena.toFixed(2)} {ccy}
              </td>
              <td style={{ padding: "8px 10px" }}>
                {(l.kolicina * l.cijena).toFixed(2)} {ccy}
              </td>
              <td style={{ padding: "8px 10px", fontSize: 12 }}>{l.serije.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 14 }}>
        Osnovica: <strong>{Number(f?.osnovica_km ?? 0).toFixed(2)} {ccy}</strong>
        {" · "}
        PDV: {Number(f?.pdv_iznos_km ?? 0).toFixed(2)} {ccy}
        {" · "}
        Ukupno: <strong>{Number(f?.iznos_ukupno_km ?? 0).toFixed(2)} {ccy}</strong>
      </p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Plaćanje zatvara izvod, isto kao i ostale Fluxa fakture.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/ops/haas" className="btn">
          Nazad
        </Link>
        <Link href={`/fakture/${fakturaId}`} className="btn">
          Kartica fakture
        </Link>
      </div>
    </OpsShell>
  );
}
