import Link from "next/link";
import { query } from "@/lib/db";
import { ExportExcelButton } from "@/components/ExportExcelButton";

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
                  <div className="brandTitle">Potraživanja</div>
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
            <Link className="btn" href="/finance/potrazivanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Lista potraživanja</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">Prikazano: {list.length} (limit 200)</span>
            <ExportExcelButton
              filename="potrazivanja"
              sheetName="Potraživanja"
              headers={["ID", "Projekat", "Datum", "Dospijeće", "Iznos (KM)", "Plaćeno (KM)", "Preostalo (KM)", "Opis", "Napomena"]}
              rows={list.map((r) => {
                const iznos = Number(r.iznos_km ?? r.iznos);
                const paid = Number(r.paid_km ?? 0);
                const rem = Number.isFinite(iznos) && Number.isFinite(paid) ? iznos - paid : null;
                return [
                  r.potrazivanje_id ?? r.id,
                  r.projekat_id ?? "",
                  fmtDate(r.datum),
                  fmtDate(r.datum_dospijeca),
                  Number.isFinite(iznos) ? iznos : "",
                  Number.isFinite(paid) ? paid : "",
                  rem != null ? rem : "",
                  r.opis ?? "",
                  r.napomena ?? "",
                ];
              })}
            />
          </span>
        </div>
        <div>
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
      </div>
    </div>
  );
}
