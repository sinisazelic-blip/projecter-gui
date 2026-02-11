import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const fmtDate = (d) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
};

function makeNeedle(row) {
  const s = (row?.partner || row?.opis || row?.napomena || "")
    .toString()
    .trim();
  if (!s) return "";
  return s.length > 40 ? s.slice(0, 40) : s;
}

export default async function PlacanjaListPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();

  let rows = null;

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(placanje_id AS CHAR) LIKE ? OR partner LIKE ? OR opis LIKE ? OR napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT placanje_id, datum, iznos_km, partner, opis, napomena, status
      FROM placanja
      ${whereSql}
      ORDER BY datum DESC, placanje_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    rows = await query(
      `SELECT * FROM placanja ORDER BY placanje_id DESC LIMIT 200`,
      [],
    );
  }

  const list = Array.isArray(rows) ? rows : [];

  return (
    <div className="container">
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Plaćanja</h1>
          <div className="subtle">
            Read-only · global crosslinks: Banka filter po redu
          </div>
        </div>
        <div className="topbar-right" style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/finance">
            Nazad
          </Link>
        </div>
      </div>

      <div className="card">
        <form
          className="card-row"
          method="GET"
          style={{ gap: 12, flexWrap: "wrap" }}
        >
          <div style={{ minWidth: 260 }}>
            <div className="label">Pretraga</div>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="ID / partner / opis…"
            />
          </div>

          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/placanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="subtle">Prikazano: {list.length} (limit 200)</div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>ID</th>
                <th style={{ width: 140 }}>Datum</th>
                <th style={{ width: 170, textAlign: "right" }}>Iznos</th>
                <th style={{ width: 260 }}>Partner</th>
                <th style={{ width: 110 }}>Banka</th>
                <th>Opis</th>
                <th style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.placanje_id ?? r.id;
                    const needle = makeNeedle(r);
                    const bankHref = needle
                      ? `/finance/banka?q=${encodeURIComponent(needle)}`
                      : "/finance/banka";

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            className="link"
                            href={`/finance/placanja/${id}`}
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{fmtDate(r.datum)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(r.iznos_km)}
                        </td>
                        <td style={{ fontWeight: 800 }}>{r.partner ?? "—"}</td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            Banka
                          </Link>
                        </td>
                        <td>
                          <div className="subtle">{r.opis ?? "—"}</div>
                          {r.napomena
                            ? <div className="subtle">
                                napomena: {r.napomena}
                              </div>
                            : null}
                        </td>
                        <td className="subtle">{r.status ?? "—"}</td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={7} className="subtle" style={{ padding: 14 }}>
                      Nema rezultata.
                    </td>
                  </tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
