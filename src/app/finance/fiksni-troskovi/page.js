import Link from "next/link";
import { query } from "@/lib/db";
import { ExportExcelButton } from "@/components/ExportExcelButton";

export const dynamic = "force-dynamic";

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
      f.zadnje_placeno,
      f.iznos,
      f.valuta,
      f.aktivan
    FROM fiksni_troskovi f
    ${whereSql}
    ORDER BY f.aktivan DESC, f.trosak_id DESC
    LIMIT 200
    `,
    params,
  ).catch(async () => {
    return await query(
      `
      SELECT *
      FROM fiksni_troskovi
      ${whereSql}
      ORDER BY trosak_id DESC
      LIMIT 200
      `,
      params,
    );
  });

  return (
    <div className="container">
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <img
                  src="/fluxa/logo-light.png"
                  alt="FLUXA"
                  className="brandLogo"
                />
                <div>
                  <div className="brandTitle">Fiksni troškovi</div>
                  <div className="brandSub">Finansije / Pretplate, zakupi, porezi</div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href="/finance/cashflow" title="Hronologija plaćanja">
                  CashFlow
                </Link>
                <Link className="btn" href="/finance/fiksni-troskovi/raspored">
                  Raspored
                </Link>
                <Link className="btn" href="/finance" title="Finansije">
                  Finansije
                </Link>
                <Link className="btn" href="/dashboard" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card tableCard" style={{ marginBottom: 14 }}>
        <form className="card-row" method="GET" style={{ gap: 12, padding: 16 }}>
          <div style={{ minWidth: 260 }}>
            <div className="label">Pretraga</div>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="ID / naziv…"
            />
          </div>
          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn--active" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/fiksni-troskovi">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Šifrarnik fiksnih troškova</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">Prikazano: {rows?.length ?? 0} (limit 200)</span>
            <ExportExcelButton
              filename="fiksni_troskovi"
              sheetName="Fiksni troškovi"
              headers={["ID", "Naziv", "Frekvencija", "Dan", "Datum dospijeća", "Iznos", "Valuta", "Zadnje plaćeno", "Aktivan"]}
              rows={(rows ?? []).map((r) => [
                r.trosak_id ?? "",
                r.naziv_troska ?? "",
                r.frekvencija ?? "",
                r.dan_u_mjesecu ?? "",
                r.datum_dospijeca ? String(r.datum_dospijeca).slice(0, 10) : "",
                r.iznos ?? "",
                r.valuta ?? "BAM",
                r.zadnje_placeno ? String(r.zadnje_placeno).slice(0, 10) : "",
                r.aktivan != null ? (r.aktivan ? "Da" : "Ne") : "",
              ])}
            />
          </span>
        </div>
        <div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Naziv</th>
                <th style={{ width: 100 }}>Frekvencija</th>
                <th style={{ width: 70 }}>Dan</th>
                <th style={{ width: 160 }}>Dospijeće</th>
                <th style={{ width: 100 }} className="num">Iznos</th>
                <th style={{ width: 130 }}>Zadnje plaćeno</th>
                <th style={{ width: 70 }}>Aktivan</th>
              </tr>
            </thead>
            <tbody>
              {rows?.length
                ? rows.map((r, idx) => (
                    <tr key={r.trosak_id ?? idx}>
                      <td>{r.trosak_id ?? "—"}</td>
                      <td style={{ fontWeight: 700 }}>
                        {r.naziv_troska ?? "—"}
                      </td>
                      <td>{r.frekvencija ?? "—"}</td>
                      <td>{r.dan_u_mjesecu ?? "—"}</td>
                      <td className="nowrap">
                        {r.datum_dospijeca
                          ? String(r.datum_dospijeca).slice(0, 10)
                          : "—"}
                      </td>
                      <td className="num">
                        {r.iznos != null
                          ? `${Number(r.iznos).toFixed(2)} ${r.valuta ?? "BAM"}`
                          : "—"}
                      </td>
                      <td className="nowrap">
                        {r.zadnje_placeno
                          ? String(r.zadnje_placeno).slice(0, 10)
                          : "—"}
                      </td>
                      <td>{r.aktivan != null ? (r.aktivan ? "Da" : "—") : "—"}</td>
                    </tr>
                  ))
                : <tr>
                    <td colSpan={8} className="muted" style={{ padding: 16 }}>
                      Nema rezultata.
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 18, border: "1px solid var(--border)", borderRadius: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Napomena</div>
        <div className="subtle" style={{ lineHeight: 1.6, fontSize: 13 }}>
          Read-only prikaz. Raspored dospijeća je na{" "}
          <Link href="/finance/fiksni-troskovi/raspored" className="btn" style={{ display: "inline-flex" }}>
            Raspored
          </Link>
          . Kasnije: CRUD + povezivanje plaćanja sa bank postinzima.
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
