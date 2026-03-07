import Link from "next/link";
import { query } from "@/lib/db";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import FluxaLogo from "@/components/FluxaLogo";

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

  let pocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };
  try {
    pocetnaStanja = await getPocetnaStanja();
  } catch {
    // ignore
  }

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
      if ((r.status || "").toUpperCase() === "STORNO") return false;
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
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">Dugovanja</div>
                  <div className="brandSub">Finansije / Obaveze prema dobavljačima</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/finance/dugovanja/novo" className="btn btn--active" title="Novo dugovanje">
                  + Novo dugovanje
                </Link>
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
            <Link className="btn" href="/finance/dugovanja">
              Reset
            </Link>
          </div>
        </form>
      </div>

      {/* Početna stanja (dobavljači + talenti) — pregled */}
      {(pocetnaStanja.dobavljaci?.length > 0 || pocetnaStanja.talenti?.length > 0) && (
        <div className="card tableCard" style={{ marginBottom: 14 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Početna stanja (31.12.) — pregled</span>
            <Link href="/finance/pocetna-stanja" className="btn" style={{ fontSize: 13 }}>
              Evidencija početnih stanja →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {pocetnaStanja.dobavljaci?.length > 0 && (
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Dobavljači</div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 10px" }}>Naziv</th>
                        <th style={{ textAlign: "right", padding: "6px 10px" }}>Iznos (KM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pocetnaStanja.dobavljaci.map((r) => (
                        <tr key={r.dobavljac_id} style={r.otpisano ? { opacity: 0.6 } : undefined}>
                          <td style={{ padding: "6px 10px" }}>{r.naziv}{r.otpisano ? " (otpisano)" : ""}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmtKM(r.iznos_km)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}>
                        <td style={{ padding: "8px 10px" }}>Ukupno (aktivna)</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          {fmtKM(pocetnaStanja.dobavljaci.filter((x) => !x.otpisano).reduce((s, x) => s + x.iznos_km, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {pocetnaStanja.talenti?.length > 0 && (
              <div style={{ padding: "10px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Talenti</div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 10px" }}>Ime i prezime</th>
                        <th style={{ textAlign: "right", padding: "6px 10px" }}>Iznos (KM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pocetnaStanja.talenti.map((r) => (
                        <tr key={r.talent_id} style={r.otpisano ? { opacity: 0.6 } : undefined}>
                          <td style={{ padding: "6px 10px" }}>{r.naziv}{r.otpisano ? " (otpisano)" : ""}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmtKM(r.iznos_km)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}>
                        <td style={{ padding: "8px 10px" }}>Ukupno (aktivna)</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          {fmtKM(pocetnaStanja.talenti.filter((x) => !x.otpisano).reduce((s, x) => s + x.iznos_km, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Lista dugovanja (projekt_dugovanja)</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">Prikazano: {list.length} (limit 200)</span>
            <ExportExcelButton
              filename="dugovanja"
              sheetName="Dugovanja"
              headers={["ID", "Projekat", "Datum", "Dospijeće", "Iznos (KM)", "Plaćeno (KM)", "Preostalo (KM)", "Opis", "Napomena"]}
              rows={list.map((r) => {
                const iznos = Number(r.iznos_km ?? r.iznos);
                const paid = Number(r.paid_km ?? 0);
                const rem = Number.isFinite(iznos) && Number.isFinite(paid) ? iznos - paid : null;
                return [
                  r.dugovanje_id,
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
        <div className="table-wrap">
          <table className="table">
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
                            className="link"
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
                          {(r.status || "").toUpperCase() === "STORNO" && (
                            <span className="badge badge-red" style={{ fontSize: 11 }}>STORNO</span>
                          )}
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
                      <td colSpan={9} className="muted" style={{ padding: 20 }}>
                        Nema dugovanja u evidenciji. Koristi „+ Novo dugovanje” u zaglavlju za unos.
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
