import Link from "next/link";
import { query } from "@/lib/db";
import KreditForm from "./KreditForm";

export const dynamic = "force-dynamic";

const fmtKM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2) + " KM";
};

const fmtDate = (d) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const parts = s.split("-");
  const y = parts[0];
  const m = parts[1]?.padStart(2, "0") ?? "";
  const day = parts[2]?.padStart(2, "0") ?? "";
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
};

function fmtMjesecGodina(d) {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m] = s.split("-");
  if (!y || !m) return String(d);
  return `${m.padStart(2, "0")}.${y}`;
}

export default async function KreditiPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();

  let rows = [];
  let tableMissing = false;

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(k.kredit_id AS CHAR) LIKE ? OR k.naziv LIKE ? OR k.banka_naziv LIKE ? OR k.napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT
        kredit_id,
        naziv,
        ukupan_iznos,
        valuta,
        broj_rata,
        uplaceno_rata,
        iznos_rate,
        datum_posljednja_rata,
        banka_naziv,
        aktivan,
        napomena
      FROM krediti
      ${whereSql}
      ORDER BY aktivan DESC, datum_posljednja_rata DESC, kredit_id DESC
      LIMIT 100
      `,
      params,
    ).catch(() => []);

    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("krediti") || msg.includes("doesn't exist")) {
      tableMissing = true;
    } else {
      throw err;
    }
  }

  const list = Array.isArray(rows) ? rows : [];

  // Računanje po redu
  const enriched = list.map((r) => {
    const brojRata = Number(r.broj_rata ?? 0);
    const uplaceno = Number(r.uplaceno_rata ?? 0);
    const ukupno = Number(r.ukupan_iznos ?? 0);
    const iznosRate = r.iznos_rate != null ? Number(r.iznos_rate) : null;

    const ostaloRata = Math.max(0, brojRata - uplaceno);
    const ostatakDuga =
      ostaloRata > 0
        ? iznosRate != null && Number.isFinite(iznosRate)
          ? ostaloRata * iznosRate
          : brojRata > 0
            ? (ukupno * ostaloRata) / brojRata
            : 0
        : 0;

    return {
      ...r,
      ostalo_rata: ostaloRata,
      ostatak_duga: ostatakDuga,
    };
  });

  const activeList = enriched.filter((r) => r.aktivan !== 0);
  const ukupnoOstatak = activeList.reduce((s, r) => s + (r.ostatak_duga ?? 0), 0);
  const ukupnoOstalihRata = activeList.reduce((s, r) => s + (r.ostalo_rata ?? 0), 0);

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
                  <div className="brandTitle">Krediti</div>
                  <div className="brandSub">
                    Ukupan pregled kreditnih obaveza
                  </div>
                </div>
              </div>

              <div className="actions">
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
          {tableMissing && (
            <div className="card" style={{ marginBottom: 12, borderLeft: "4px solid #f59e0b" }}>
              <div className="cardTitle">Tabela još ne postoji</div>
              <div className="cardSub" style={{ lineHeight: 1.6 }}>
                Pokreni SQL skriptu:{" "}
                <code>mysql -u USER -p DATABASE &lt; scripts/create-krediti.sql</code>
              </div>
            </div>
          )}

          {!tableMissing && (
            <>
              <div className="card">
                <div className="cardHead">
                  <div className="cardTitle">Ukupno (aktivni krediti)</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Ostatak duga
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                      {fmtKM(ukupnoOstatak)}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Ostalo rata
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                      {ukupnoOstalihRata}
                    </div>
                  </div>
                </div>
              </div>

              <KreditForm />

              <div className="card" style={{ marginTop: 12 }}>
                <form method="GET" className="filters" style={{ flexWrap: "wrap" }}>
                  <div className="field">
                    <span className="label">Pretraga</span>
                    <input
                      className="input"
                      name="q"
                      defaultValue={q}
                      placeholder="Naziv / banka…"
                    />
                  </div>
                  <div className="actions">
                    <button type="submit" className="btn btn--active">
                      Primijeni
                    </button>
                    <Link className="btn" href="/finance/krediti">
                      Reset
                    </Link>
                  </div>
                </form>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <div className="cardHead">
                  <div className="cardTitleRow">
                    <div className="cardTitle">Lista kredita</div>
                    <span className="muted">Prikazano: {list.length}</span>
                  </div>
                </div>

                <div className="tableCard">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>Naziv</th>
                        <th>Banka</th>
                        <th className="num" style={{ width: 110 }}>Ukupan iznos</th>
                        <th className="num" style={{ width: 110 }}>Broj rata</th>
                        <th className="num" style={{ width: 110 }}>Uplaćeno rata</th>
                        <th className="num" style={{ width: 110 }}>Ostatak duga</th>
                        <th style={{ width: 100 }}>Ostalo rata</th>
                        <th style={{ width: 110 }}>Posljednja rata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length
                        ? enriched.map((r) => (
                            <tr key={r.kredit_id}>
                              <td>{r.kredit_id}</td>
                              <td style={{ fontWeight: 700 }}>
                                {r.naziv ?? "—"}
                              </td>
                              <td>{r.banka_naziv ?? "—"}</td>
                              <td className="num">{fmtKM(r.ukupan_iznos)}</td>
                              <td className="num">{r.broj_rata ?? "—"}</td>
                              <td className="num">{r.uplaceno_rata ?? "—"}</td>
                              <td className="num">{fmtKM(r.ostatak_duga)}</td>
                              <td className="num">{r.ostalo_rata}</td>
                              <td className="nowrap">
                                {fmtMjesecGodina(r.datum_posljednja_rata)}
                              </td>
                            </tr>
                          ))
                        : (
                            <tr>
                              <td colSpan={9} className="muted" style={{ padding: 16 }}>
                                Nema kredita. Pokreni SQL skriptu za kreiranje tabele.
                              </td>
                            </tr>
                          )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
