import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { query } from "@/lib/db";
import KufImportForm from "./KufImportForm";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

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

export default async function KufPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

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

  const getTipLabel = (tip) =>
    ({ PROJEKTNI_TROSAK: t("kuf.tipProjektni"), FIKSNI_TROSAK: t("kuf.tipFiksni"), VANREDNI_TROSAK: t("kuf.tipVanredni"), INVESTICIJE: t("kuf.tipInvesticije") }[tip] ?? tip);

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
                  <div className="brandTitle">{t("kuf.title")}</div>
                  <div className="brandSub">{t("kuf.subtitle")}</div>
                </div>
              </div>

              <div className="actions">
                {locale === "sr" && (
                  <Link className="btn" href="/finance" title={t("finance.title")}>
                    {t("finance.title")}
                  </Link>
                )}
                <Link className="btn" href="/dashboard" title={t("common.dashboard")}>
                  🏠 {t("common.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          {tableMissing && (
            <div className="card" style={{ marginBottom: 12, borderLeft: "4px solid #f59e0b" }}>
              <div className="cardTitle">{t("kuf.tableMissingTitle")}</div>
              <div className="cardSub" style={{ lineHeight: 1.6 }}>
                {t("kuf.tableMissingRun")}{" "}
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
                <span className="label">{t("kuf.filterSearch")}</span>
                <input
                  className="input"
                  name="q"
                  defaultValue={q}
                  placeholder={t("kuf.filterSearchPlaceholder")}
                />
              </div>
              <div className="field">
                <span className="label">{t("kuf.filterType")}</span>
                <select className="input" name="tip" defaultValue={tip}>
                  <option value="">{t("kuf.filterAll")}</option>
                  <option value="PROJEKTNI_TROSAK">{t("kuf.tipProjektni")}</option>
                  <option value="FIKSNI_TROSAK">{t("kuf.tipFiksni")}</option>
                  <option value="VANREDNI_TROSAK">{t("kuf.tipVanredni")}</option>
                  <option value="INVESTICIJE">{t("kuf.tipInvesticije")}</option>
                </select>
              </div>
              <div className="actions">
                <button type="submit" className="btn btn--active">
                  {t("kuf.apply")}
                </button>
                <Link className="btn" href="/finance/kuf">
                  {t("kuf.reset")}
                </Link>
              </div>
            </form>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="cardHead">
              <div className="cardTitleRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div className="cardTitle">{t("kuf.listTitle")}</div>
                <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="muted">{(t("kuf.shownCount") || "").replace("{{count}}", list.length)}</span>
                  <ExportExcelButton
                    filename="kuf_ulazne_fakture"
                    sheetName="KUF"
                    headers={[t("kuf.colId"), t("kuf.colBroj"), t("kuf.colDatum"), t("kuf.colDospijece"), t("kuf.colPartner"), t("kuf.colIznos"), t("kuf.colValuta"), t("kuf.colIznosKm"), t("kuf.colOpis"), t("kuf.colTip"), t("kuf.colProjekat"), t("kuf.colFiksni")]}
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
                    <th style={{ width: 70 }}>{t("kuf.colId")}</th>
                    <th style={{ width: 100 }}>{t("kuf.tableColBroj")}</th>
                    <th style={{ width: 100 }}>{t("kuf.tableColDatum")}</th>
                    <th style={{ width: 100 }}>{t("kuf.tableColDospijece")}</th>
                    <th>{t("kuf.tableColPartner")}</th>
                    <th className="num" style={{ width: 100 }}>{t("kuf.colIznos")}</th>
                    <th style={{ width: 120 }}>{t("kuf.tableColOpis")}</th>
                    <th style={{ width: 100 }}>{t("kuf.tableColRasknj")}</th>
                    <th style={{ width: 120 }}>{t("kuf.tableColVeza")}</th>
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
                            {formatAmount(r.iznos_km ?? r.iznos, locale)}
                            {r.valuta !== "BAM" ? ` (${r.valuta})` : ""}
                          </td>
                          <td>{r.opis ?? "—"}</td>
                          <td>
                            {getTipLabel(r.tip_rasknjizavanja)}
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
                                {t("kuf.fixedCostLink")} #{r.fiksni_trosak_id}
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
                            {t("kuf.noEntries")}
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
