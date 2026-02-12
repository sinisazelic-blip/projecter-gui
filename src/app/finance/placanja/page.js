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
                  <div className="brandTitle">Plaćanja</div>
                  <div className="brandSub">Finansije · Banka filter po redu</div>
                </div>
              </div>

              <div className="actions">
                <Link href="/finance" className="btn" title="Finansije">
                  Finansije
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  🏠 Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card tableCard" style={{ marginBottom: 14 }}>
        <form className="filters" method="GET" style={{ flexWrap: "wrap", padding: 16 }}>
          <div className="field">
            <span className="label">Pretraga</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="ID / partner / opis…"
            />
          </div>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/placanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Lista plaćanja</span>
          <span className="muted">Prikazano: {list.length} (limit 200)</span>
        </div>
        <div>
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
      </div>
    </div>
  );
}
