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
  const s = (row?.opis || row?.napomena || "").toString().trim();
  if (!s) return "";
  return s.length > 40 ? s.slice(0, 40) : s;
}

export default async function DugovanjaListPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const onlyOpen = sp?.only_open === "1";

  let rows = null;

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(d.dugovanje_id AS CHAR) LIKE ? OR CAST(d.projekat_id AS CHAR) LIKE ? OR d.opis LIKE ? OR d.napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT
        d.dugovanje_id,
        d.projekat_id,
        d.dobavljac_id,
        d.datum,
        d.datum_dospijeca,
        d.iznos_km,
        d.opis,
        d.status,
        COALESCE(v.paid_km, 0) AS paid_km
      FROM projekt_dugovanja d
      LEFT JOIN v_dugovanja_paid_sum v ON v.dugovanje_id = d.dugovanje_id
      ${whereSql}
      ORDER BY COALESCE(d.datum_dospijeca, d.datum) DESC, d.dugovanje_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(dugovanje_id AS CHAR) LIKE ? OR CAST(projekat_id AS CHAR) LIKE ? OR opis LIKE ? OR napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT *
      FROM projekt_dugovanja
      ${whereSql}
      ORDER BY dugovanje_id DESC
      LIMIT 200
      `,
      params,
    );
  }

  let list = Array.isArray(rows) ? rows : [];
  if (onlyOpen) {
    list = list.filter((r) => {
      const iznos = Number(r.iznos_km ?? r.iznos);
      const paid = Number(r.paid_km ?? 0);
      if (!Number.isFinite(iznos)) return true;
      if (!Number.isFinite(paid)) return true;
      return iznos - paid > 0.0001;
    });
  }

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
                  <div className="brandTitle">Dugovanja</div>
                  <div className="brandSub">Finansije / Obaveze prema dobavljačima</div>
                </div>
              </div>

              <Link href="/finance" className="btn" title="Finansije">
                Finansije
              </Link>
              <Link href="/dashboard" className="btn" title="Dashboard">
                🏠 Dashboard
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card">
        <form className="filters" method="GET" style={{ flexWrap: "wrap" }}>
          <div className="field">
            <span className="label">Pretraga</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="ID / projekat / opis…"
            />
          </div>

          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="only_open"
              value="1"
              defaultChecked={onlyOpen}
            />
            <span className="label" style={{ marginBottom: 0 }}>Samo otvorena</span>
          </label>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/dugovanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="cardHead">
          <div className="cardTitleRow">
            <div className="cardTitle">Lista dugovanja</div>
            <span className="muted">Prikazano: {list.length} (limit 200)</span>
          </div>
        </div>

        <div className="tableCard">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>ID</th>
                <th style={{ width: 90 }}>Projekat</th>
                <th style={{ width: 140 }}>Datum</th>
                <th style={{ width: 140 }}>Dospijeće</th>
                <th className="num">Iznos</th>
                <th className="num">Plaćeno</th>
                <th className="num">Preostalo</th>
                <th>Opis</th>
                <th style={{ width: 90 }}>Banka</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.dugovanje_id;
                    const proj = r.projekat_id;
                    const iznos = Number(r.iznos_km ?? r.iznos);
                    const paid = Number(r.paid_km ?? 0);
                    const rem =
                      Number.isFinite(iznos) && Number.isFinite(paid)
                        ? iznos - paid
                        : null;

                    const needle = makeNeedle(r);
                    const bankHref = needle
                      ? `/finance/banka?q=${encodeURIComponent(needle)}`
                      : "/finance/banka";

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            href={`/finance/dugovanja/${id}`}
                            className="projectLink"
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{proj ?? "—"}</td>
                        <td className="nowrap">{fmtDate(r.datum)}</td>
                        <td className="nowrap">{fmtDate(r.datum_dospijeca)}</td>
                        <td className="num">{fmtKM(iznos)}</td>
                        <td className="num">{fmtKM(paid)}</td>
                        <td className="num">
                          {rem === null ? "—" : fmtKM(rem)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{r.opis ?? "—"}</div>
                          {r.napomena ? (
                            <div className="muted">{r.napomena}</div>
                          ) : null}
                        </td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            Banka
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                : (
                    <tr>
                      <td colSpan={9} className="muted" style={{ padding: 16 }}>
                        Nema rezultata.
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
