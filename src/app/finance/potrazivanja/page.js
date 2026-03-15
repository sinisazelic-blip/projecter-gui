import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { query } from "@/lib/db";
import { getPocetnaStanja } from "@/lib/pocetna-stanja";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

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
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const onlyOpen = sp?.only_open === "1";

  let pocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };
  try {
    pocetnaStanja = await getPocetnaStanja();
  } catch {
    // ignore
  }

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

  // apply onlyOpen in JS: samo otvorena (preostalo > 0) i nisu otpisana
  let list = Array.isArray(rows) ? rows : [];
  if (onlyOpen) {
    list = list.filter((r) => {
      if ((r.status || "").toUpperCase() === "OTPISANO") return false;
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
                  <div className="brandTitle">{t("potrazivanja.title")}</div>
                  <div className="brandSub">{t("potrazivanja.subtitle")}</div>
                </div>
              </div>

              <div className="actions">
                <Link href="/finance" className="btn" title={t("finance.title")}>
                  {t("finance.title")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
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
            <span className="label">{t("potrazivanja.search")}</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder={t("potrazivanja.searchPlaceholder")}
            />
          </div>

          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="only_open"
              value="1"
              defaultChecked={onlyOpen}
            />
            <span className="label" style={{ marginBottom: 0 }}>{t("potrazivanja.onlyOpen")}</span>
          </label>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              {t("potrazivanja.apply")}
            </button>
            <Link className="btn" href="/finance/potrazivanja">
              {t("potrazivanja.reset")}
            </Link>
          </div>
        </form>
      </div>

      {/* Početna stanja — potraživanja od klijenata */}
      {pocetnaStanja.klijenti?.length > 0 && (
        <div className="card tableCard" style={{ marginBottom: 14 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t("potrazivanja.pocetnaStanjaKlijentiPreview")}</span>
            <Link href="/finance/pocetna-stanja" className="btn" style={{ fontSize: 13 }}>
              {t("potrazivanja.evidencijaPocetnaStanja")}
            </Link>
          </div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>{t("potrazivanja.colKlijent")}</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>{t("pocetnaStanja.colIznosKm")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pocetnaStanja.klijenti.map((r) => (
                    <tr key={r.klijent_id} style={r.otpisano ? { opacity: 0.6 } : undefined}>
                      <td style={{ padding: "6px 10px" }}>{r.naziv}{r.otpisano && ` ${t("potrazivanja.otpisano")}`}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{formatAmount(r.iznos_km, locale)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}>
                    <td style={{ padding: "8px 10px" }}>{t("potrazivanja.ukupnoAktivna")}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      {formatAmount(pocetnaStanja.klijenti.filter((x) => !x.otpisano).reduce((s, x) => s + x.iznos_km, 0), locale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("potrazivanja.listTitle")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">{(t("potrazivanja.shownCount") || "").replace("{{count}}", list.length)}</span>
            <ExportExcelButton
              filename="potrazivanja"
              sheetName={t("potrazivanja.excelSheetName")}
              headers={[t("potrazivanja.colId"), t("potrazivanja.colProjekat"), t("potrazivanja.colDatum"), t("potrazivanja.colDospijece"), t("potrazivanja.colIznos"), t("potrazivanja.colPlaceno"), t("potrazivanja.colPreostalo"), t("potrazivanja.colOpis"), t("potrazivanja.colNapomena")]}
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
        <div style={{ overflowX: "auto" }} className="potrazivanja-table-wrap">
          <table className="table potrazivanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "41%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t("potrazivanja.colId")}</th>
                <th>{t("potrazivanja.colProjekat")}</th>
                <th>{t("potrazivanja.colDatum")}</th>
                <th>{t("potrazivanja.colDospijece")}</th>
                <th className="num">{t("potrazivanja.colIznos")}</th>
                <th className="num">{t("potrazivanja.colPlaceno")}</th>
                <th className="num">{t("potrazivanja.colPreostalo")}</th>
                <th>{t("potrazivanja.banka")}</th>
                <th>{t("potrazivanja.colOpis")}</th>
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
                          {formatAmount(iznos, locale)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatAmount(paid, locale)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {rem === null ? "—" : formatAmount(rem, locale)}
                        </td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            Banka
                          </Link>
                        </td>
                        <td style={{ maxWidth: 0 }}>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                            title={[r.opis, r.napomena].filter(Boolean).join(" — ")}
                          >
                            {r.opis ?? "—"}
                          </div>
                          {(r.napomena || rem != null || (r.status || "").toUpperCase() === "OTPISANO") && (
                            <div className="subtle" style={{ fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {(r.status || "").toUpperCase() === "OTPISANO" && badge("OTPISANO", "bad")}
                              {r.napomena && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{r.napomena}</span>}
                              {rem != null && (r.status || "").toUpperCase() !== "OTPISANO" && (rem <= 0.0001 ? badge("ZATVORENO", "ok") : badge("OTVORENO", "warn"))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={9} className="subtle" style={{ padding: 20, textAlign: "center" }}>
                      {t("potrazivanja.noResults")}
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
