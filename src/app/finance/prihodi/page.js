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

export default async function PrihodiListPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const projekatId = (sp?.projekat_id ?? "").trim();

  let rows = null;

  try {
    const where = [];
    const params = [];

    if (projekatId) {
      where.push("projekat_id = ?");
      params.push(Number(projekatId));
    }
    if (q) {
      where.push(
        "(CAST(prihod_id AS CHAR) LIKE ? OR opis LIKE ? OR napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT prihod_id, projekat_id, datum, iznos_km, opis, napomena, status
      FROM projektni_prihodi
      ${whereSql}
      ORDER BY datum DESC, prihod_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    rows = await query(
      `SELECT * FROM projektni_prihodi ORDER BY prihod_id DESC LIMIT 200`,
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
                  <div className="brandTitle">Prihodi</div>
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
      <div className="card">
        <form className="filters" method="GET" style={{ flexWrap: "wrap" }}>
          <div className="field">
            <span className="label">Pretraga</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="ID / opis…"
            />
          </div>

          <div className="field">
            <span className="label">projekat_id</span>
            <input
              className="input"
              name="projekat_id"
              defaultValue={projekatId}
              placeholder="npr. 77"
            />
          </div>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/prihodi">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="cardHead">
          <div className="cardTitleRow">
            <div className="cardTitle">Lista prihoda</div>
            <span className="muted">Prikazano: {list.length} (limit 200)</span>
          </div>
        </div>

        <div className="tableCard">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>ID</th>
                <th style={{ width: 120 }}>Projekat</th>
                <th style={{ width: 140 }}>Datum</th>
                <th style={{ width: 170, textAlign: "right" }}>Iznos</th>
                <th style={{ width: 110 }}>Banka</th>
                <th>Opis</th>
                <th style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.prihod_id ?? r.id;
                    const needle = makeNeedle(r);
                    const bankHref = needle
                      ? `/finance/banka?q=${encodeURIComponent(needle)}`
                      : "/finance/banka";

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            className="link"
                            href={`/finance/prihodi/${id}`}
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{r.projekat_id ?? "—"}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(r.iznos_km)}
                        </td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            Banka
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{r.opis ?? "—"}</div>
                          {r.napomena
                            ? <div className="subtle">{r.napomena}</div>
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
