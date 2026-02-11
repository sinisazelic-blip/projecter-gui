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
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Prihodi</h1>
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
              placeholder="ID / opis…"
            />
          </div>

          <div style={{ width: 180 }}>
            <div className="label">projekat_id</div>
            <input
              className="input"
              name="projekat_id"
              defaultValue={projekatId}
              placeholder="npr. 77"
            />
          </div>

          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/prihodi">
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
  );
}
