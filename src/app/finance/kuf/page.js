import Link from "next/link";
import { query } from "@/lib/db";
import KufImportForm from "./KufImportForm";
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
  const parts = s.split("-");
  const y = parts[0];
  const m = parts[1]?.padStart(2, "0") ?? "";
  const day = parts[2]?.padStart(2, "0") ?? "";
  if (!y || !m || !day) return String(d);
  return `${day}.${m}.${y}`;
};

const TIP_LABELS = {
  PROJEKTNI_TROSAK: "Projektni",
  FIKSNI_TROSAK: "Fiksni",
  VANREDNI_TROSAK: "Vanredni",
  INVESTICIJE: "Investicije",
};

export default async function KufPage({ searchParams }) {
  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const tip = sp?.tip ?? "";

  let rows = [];
  let dobavljaci = [];
  let klijenti = [];
  let projekti = [];
  let fiksniTroskovi = [];
  let tableMissing = false;

  try {
    [rows, dobavljaci, klijenti, projekti, fiksniTroskovi] = await Promise.all([
    query(
      `
      SELECT
        k.kuf_id,
        k.broj_fakture,
        k.datum_fakture,
        k.datum_dospijeca,
        k.dobavljac_id,
        k.klijent_id,
        k.partner_naziv,
        k.iznos,
        k.valuta,
        k.iznos_km,
        k.opis,
        k.tip_rasknjizavanja,
        k.projekat_id,
        k.fiksni_trosak_id,
        k.vanredni_podtip,
        k.investicija_opis,
        k.status,
        d.naziv AS dobavljac_naziv,
        kl.naziv_klijenta AS klijent_naziv,
        p.radni_naziv AS projekat_naziv,
        f.naziv_troska AS fiksni_trosak_naziv
      FROM kuf_ulazne_fakture k
      LEFT JOIN dobavljaci d ON d.dobavljac_id = k.dobavljac_id
      LEFT JOIN klijenti kl ON kl.klijent_id = k.klijent_id
      LEFT JOIN projekti p ON p.projekat_id = k.projekat_id
      LEFT JOIN fiksni_troskovi f ON f.trosak_id = k.fiksni_trosak_id
      ORDER BY k.datum_fakture DESC, k.kuf_id DESC
      LIMIT 200
      `,
      [],
    ).catch(() => []),
    query(
      `SELECT dobavljac_id, naziv FROM dobavljaci WHERE aktivan = 1 ORDER BY naziv ASC LIMIT 500`,
      [],
    ).catch(() => []),
    query(
      `SELECT klijent_id, naziv_klijenta FROM klijenti ORDER BY naziv_klijenta ASC LIMIT 500`,
      [],
    ).catch(() => []),
    query(
      `SELECT projekat_id, radni_naziv FROM projekti WHERE status_id BETWEEN 1 AND 8 ORDER BY projekat_id DESC LIMIT 500`,
      [],
    ).catch(() => []),
    query(
      `SELECT trosak_id, naziv_troska FROM fiksni_troskovi WHERE aktivan = 1 ORDER BY naziv_troska ASC LIMIT 200`,
      [],
    ).catch(() => []),
    ]);
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("kuf_ulazne_fakture") || msg.includes("doesn't exist")) {
      tableMissing = true;
    } else {
      throw err;
    }
  }

  let list = Array.isArray(rows) ? rows : [];
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (r) =>
        String(r.kuf_id ?? "").includes(needle) ||
        String(r.broj_fakture ?? "").toLowerCase().includes(needle) ||
        String(r.partner_naziv ?? r.dobavljac_naziv ?? r.klijent_naziv ?? "")
          .toLowerCase()
          .includes(needle) ||
        String(r.opis ?? "").toLowerCase().includes(needle),
    );
  }
  if (tip) {
    list = list.filter((r) => r.tip_rasknjizavanja === tip);
  }

  const partnerName = (r) =>
    r.dobavljac_naziv || r.klijent_naziv || r.partner_naziv || "—";

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
                  <div className="brandTitle">KUF (ulazne fakture)</div>
                  <div className="brandSub">
                    Import i rasknjižavanje: projektni, fiksni, vanredni, investicije
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
                <code>mysql -u USER -p DATABASE &lt; scripts/create-kuf-ulazne-fakture.sql</code>
              </div>
            </div>
          )}

          {!tableMissing && (
            <KufImportForm
              dobavljaci={dobavljaci}
              klijenti={klijenti}
              projekti={projekti}
              fiksniTroskovi={fiksniTroskovi}
            />
          )}

          {!tableMissing && (
          <>
          <div className="card" style={{ marginTop: 12 }}>
            <form method="GET" className="filters" style={{ flexWrap: "wrap" }}>
              <div className="field">
                <span className="label">Pretraga</span>
                <input
                  className="input"
                  name="q"
                  defaultValue={q}
                  placeholder="ID / broj / partner / opis"
                />
              </div>
              <div className="field">
                <span className="label">Tip</span>
                <select className="input" name="tip" defaultValue={tip}>
                  <option value="">Svi</option>
                  <option value="PROJEKTNI_TROSAK">Projektni</option>
                  <option value="FIKSNI_TROSAK">Fiksni</option>
                  <option value="VANREDNI_TROSAK">Vanredni</option>
                  <option value="INVESTICIJE">Investicije</option>
                </select>
              </div>
              <div className="actions">
                <button type="submit" className="btn btn--active">
                  Primijeni
                </button>
                <Link className="btn" href="/finance/kuf">
                  Reset
                </Link>
              </div>
            </form>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="cardHead">
              <div className="cardTitleRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div className="cardTitle">Lista ulaznih faktura</div>
                <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="muted">Prikazano: {list.length} (limit 200)</span>
                  <ExportExcelButton
                    filename="kuf_ulazne_fakture"
                    sheetName="KUF"
                    headers={["ID", "Broj fakture", "Datum", "Dospijeće", "Partner", "Iznos", "Valuta", "Iznos (KM)", "Opis", "Tip rasknjižavanja", "Projekat", "Fiksni trošak"]}
                    rows={list.map((r) => [
                      r.kuf_id ?? "",
                      r.broj_fakture ?? "",
                      fmtDate(r.datum_fakture),
                      fmtDate(r.datum_dospijeca),
                      partnerName(r),
                      r.iznos ?? "",
                      r.valuta ?? "",
                      r.iznos_km ?? "",
                      r.opis ?? "",
                      r.tip_rasknjizavanja ?? "",
                      r.projekat_naziv ?? r.projekat_id ?? "",
                      r.fiksni_trosak_naziv ?? r.fiksni_trosak_id ?? "",
                    ])}
                  />
                </span>
              </div>
            </div>

            <div className="tableCard">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th style={{ width: 100 }}>Broj</th>
                    <th style={{ width: 100 }}>Datum (dd.mm.yyyy)</th>
                    <th style={{ width: 100 }}>Dospijeće</th>
                    <th>Partner / dobavljač</th>
                    <th className="num" style={{ width: 100 }}>Iznos</th>
                    <th style={{ width: 120 }}>Opis</th>
                    <th style={{ width: 100 }}>Rasknjižavanje</th>
                    <th style={{ width: 120 }}>Veza</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length
                    ? list.map((r) => (
                        <tr key={r.kuf_id}>
                          <td>{r.kuf_id}</td>
                          <td>{r.broj_fakture ?? "—"}</td>
                          <td className="nowrap">{fmtDate(r.datum_fakture)}</td>
                          <td className="nowrap">{fmtDate(r.datum_dospijeca)}</td>
                          <td>{partnerName(r)}</td>
                          <td className="num">
                            {fmtKM(r.iznos_km ?? r.iznos)}
                            {r.valuta !== "BAM" ? ` (${r.valuta})` : ""}
                          </td>
                          <td>{r.opis ?? "—"}</td>
                          <td>
                            {TIP_LABELS[r.tip_rasknjizavanja] ?? r.tip_rasknjizavanja}
                            {r.vanredni_podtip && (
                              <span className="muted"> · {r.vanredni_podtip}</span>
                            )}
                          </td>
                          <td>
                            {r.projekat_id ? (
                              <Link
                                href={`/projects/${r.projekat_id}`}
                                className="btn"
                                style={{ fontSize: 12 }}
                              >
                                #{r.projekat_id}
                              </Link>
                            ) : r.fiksni_trosak_id ? (
                              <Link
                                href="/finance/fiksni-troskovi"
                                className="btn"
                                style={{ fontSize: 12 }}
                              >
                                Fiksni #{r.fiksni_trosak_id}
                              </Link>
                            ) : r.investicija_opis ? (
                              <span className="muted">{r.investicija_opis}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))
                    : (
                        <tr>
                          <td colSpan={9} className="muted" style={{ padding: 16 }}>
                            Nema unosa. Unesi prvu ulaznu fakturu gore.
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
