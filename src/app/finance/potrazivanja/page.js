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

function badge(text, kind = "neutral") {
  const cls =
    kind === "ok"
      ? "badge badge-green"
      : kind === "warn"
        ? "badge badge-orange"
        : kind === "bad"
          ? "badge badge-red"
          : "badge";
  return <span className={cls}>{text}</span>;
}

function makeNeedle(row) {
  const s = (row?.opis || row?.napomena || "").toString().trim();
  if (!s) return "";
  return s.length > 40 ? s.slice(0, 40) : s;
}

export default async function PotrazivanjaListPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const onlyOpen = sp?.only_open === "1";

  // paid sums (optional)
  // pokušavamo join na view; ako view/kolone drugačije, fallback na plain list
  let rows = null;

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(p.potrazivanje_id AS CHAR) LIKE ? OR CAST(p.projekat_id AS CHAR) LIKE ? OR p.opis LIKE ? OR p.napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT
        p.potrazivanje_id,
        p.projekat_id,
        p.datum,
        p.datum_dospijeca,
        p.iznos_km,
        p.opis,
        p.status,
        COALESCE(v.paid_km, v.paid_sum_km, v.paid_sum, v.paid, 0) AS paid_km
      FROM projekt_potrazivanja p
      LEFT JOIN v_potrazivanja_paid_sum v ON v.potrazivanje_id = p.potrazivanje_id
      ${whereSql}
      ORDER BY COALESCE(p.datum_dospijeca, p.datum) DESC, p.potrazivanje_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    // fallback: bez view-a
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(potrazivanje_id AS CHAR) LIKE ? OR CAST(projekat_id AS CHAR) LIKE ? OR opis LIKE ? OR napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT *
      FROM projekt_potrazivanja
      ${whereSql}
      ORDER BY potrazivanje_id DESC
      LIMIT 200
      `,
      params,
    );
  }

  // apply onlyOpen in JS (jer paid col možda ne postoji u fallbacku)
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
      <div className="topbar glass">
        <div className="topbar-left">
          <h1 className="h1">Potraživanja</h1>
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
              placeholder="ID / projekat / opis…"
            />
          </div>

          <label
            className="subtle"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 22,
            }}
          >
            <input
              type="checkbox"
              name="only_open"
              value="1"
              defaultChecked={onlyOpen}
            />
            Samo otvorena (iznos − paid &gt; 0)
          </label>

          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">
              Primijeni
            </button>
            <Link className="btn" href="/finance/potrazivanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-row" style={{ justifyContent: "space-between" }}>
          <div className="subtle">Prikazano: {list.length} (limit 200)</div>
          <div className="subtle">
            Kolona “Banka” otvara filter na /finance/banka
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>ID</th>
                <th style={{ width: 120 }}>Projekat</th>
                <th style={{ width: 140 }}>Datum</th>
                <th style={{ width: 140 }}>Dospijeće</th>
                <th style={{ width: 160, textAlign: "right" }}>Iznos</th>
                <th style={{ width: 160, textAlign: "right" }}>Paid</th>
                <th style={{ width: 160, textAlign: "right" }}>Preostalo</th>
                <th style={{ width: 110 }}>Banka</th>
                <th>Opis</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.potrazivanje_id ?? r.id;
                    const proj = r.projekat_id ?? r.projekat;
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
                            className="link"
                            href={`/finance/potrazivanja/${id}`}
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{proj ?? "—"}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td>{fmtDate(r.datum_dospijeca)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(iznos)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtKM(paid)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {rem === null ? "—" : fmtKM(rem)}
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
                          {rem !== null
                            ? <div className="subtle" style={{ marginTop: 6 }}>
                                {rem <= 0.0001
                                  ? badge("ZATVORENO", "ok")
                                  : badge("OTVORENO", "warn")}
                              </div>
                            : null}
                        </td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={9} className="subtle" style={{ padding: 14 }}>
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
