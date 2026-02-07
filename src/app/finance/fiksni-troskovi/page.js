import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

export default async function FiksniTroskoviPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();

  const where = [];
  const params = [];

  if (q) {
    where.push("(CAST(f.trosak_id AS CHAR) LIKE ? OR f.naziv_troska LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query(
    `
    SELECT
      f.trosak_id,
      f.naziv_troska,
      f.frekvencija,
      f.dan_u_mjesecu,
      f.datum_dospijeca,
      f.zadnje_placeno
    FROM fiksni_troskovi f
    ${whereSql}
    ORDER BY f.trosak_id DESC
    LIMIT 200
    `,
    params
  ).catch(async () => {
    return await query(
      `
      SELECT *
      FROM fiksni_troskovi
      ${whereSql}
      ORDER BY trosak_id DESC
      LIMIT 200
      `,
      params
    );
  });

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Fiksni troškovi</h1>
          <div className="subtle">Read-only skeleton (SOON: raspored + bank linkovi)</div>
        </div>
        <div className="topbar-right">
          <Link className="btn" href="/finance">
            Nazad
          </Link>
        </div>
      </div>

      <div className="card">
        <form className="card-row" method="GET" style={{ gap: 12 }}>
          <div style={{ minWidth: 260 }}>
            <div className="label">Pretraga</div>
            <input className="input" name="q" defaultValue={q} placeholder="ID / naziv…" />
          </div>
          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">Primijeni</button>
            <Link className="btn" href="/finance/fiksni-troskovi">Reset</Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-row" style={{ justifyContent: "space-between" }}>
          <div className="subtle">Prikazano: {rows?.length ?? 0} (limit 200)</div>
          <div className="subtle">Raspored (vw_*) ćemo u sljedećem koraku.</div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>ID</th>
                <th>Naziv</th>
                <th style={{ width: 140 }}>Frekvencija</th>
                <th style={{ width: 140 }}>Dan</th>
                <th style={{ width: 160 }}>Dospijeće</th>
                <th style={{ width: 160 }}>Zadnje plaćeno</th>
              </tr>
            </thead>
            <tbody>
              {rows?.length ? (
                rows.map((r, idx) => (
                  <tr key={r.trosak_id ?? idx}>
                    <td>{r.trosak_id ?? "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.naziv_troska ?? "—"}</td>
                    <td>{r.frekvencija ?? "—"}</td>
                    <td>{r.dan_u_mjesecu ?? "—"}</td>
                    <td>{r.datum_dospijeca ? String(r.datum_dospijeca).slice(0, 10) : "—"}</td>
                    <td>{r.zadnje_placeno ? String(r.zadnje_placeno).slice(0, 10) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="subtle" style={{ padding: 16 }}>
                    Nema rezultata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="h2" style={{ marginTop: 0 }}>Napomena</div>
        <div className="subtle" style={{ lineHeight: 1.6 }}>
          Ovdje je cilj prvo stabilan read-only prikaz. Kasnije dodajemo raspored (vw_fiksni_troskovi_*),
          kao i povezivanje plaćanja sa bank postinzima preko <code>bank_tx_fixed_link</code>.
        </div>
      </div>
    </div>
  );
}
