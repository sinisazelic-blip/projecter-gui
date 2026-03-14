import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { query } from "@/lib/db";
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

function makeNeedle(row) {
  const s = (row?.partner || row?.opis || row?.napomena || "")
    .toString()
    .trim();
  if (!s) return "";
  return s.length > 40 ? s.slice(0, 40) : s;
}

export default async function PlacanjaListPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();

  let rows = null;

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(
        "(CAST(placanje_id AS CHAR) LIKE ? OR partner LIKE ? OR opis LIKE ? OR napomena LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    rows = await query(
      `
      SELECT placanje_id, datum, iznos_km, partner, opis, napomena, status
      FROM placanja
      ${whereSql}
      ORDER BY datum DESC, placanje_id DESC
      LIMIT 200
      `,
      params,
    );
  } catch {
    rows = await query(
      `SELECT * FROM placanja ORDER BY placanje_id DESC LIMIT 200`,
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
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("placanja.title")}</div>
                  <div className="brandSub">{t("placanja.subtitle")}</div>
                </div>
              </div>

              <div className="actions">
                <Link href="/finance" className="btn" title={t("finance.title")}>
                  {t("finance.title")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  🏠 {t("common.dashboard")}
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
            <span className="label">{t("placanja.search")}</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder={t("placanja.searchPlaceholder")}
            />
          </div>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              {t("placanja.apply")}
            </button>
            <Link className="btn" href="/finance/placanja">
              {t("placanja.reset")}
            </Link>
          </div>
        </form>
      </div>

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("placanja.listTitle")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">{(t("placanja.shownCount") || "").replace("{{count}}", list.length)}</span>
            <ExportExcelButton
              filename="placanja"
              sheetName={t("placanja.excelSheetName")}
              headers={[t("placanja.colId"), t("placanja.colDatum"), t("placanja.colIznos"), t("placanja.colPartner"), t("placanja.colOpis"), t("placanja.colNapomena"), t("placanja.colStatus")]}
              rows={list.map((r) => [
                r.placanje_id ?? r.id,
                fmtDate(r.datum),
                r.iznos_km ?? "",
                r.partner ?? "",
                r.opis ?? "",
                r.napomena ?? "",
                r.status ?? "",
              ])}
            />
          </span>
        </div>
        <div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>{t("placanja.colId")}</th>
                <th style={{ width: 140 }}>{t("placanja.colDatum")}</th>
                <th style={{ width: 170, textAlign: "right" }}>{t("placanja.colIznos")}</th>
                <th style={{ width: 260 }}>{t("placanja.colPartner")}</th>
                <th style={{ width: 110 }}>{t("placanja.banka")}</th>
                <th>{t("placanja.colOpis")}</th>
                <th style={{ width: 120 }}>{t("placanja.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.placanje_id ?? r.id;
                    const needle = makeNeedle(r);
                    const bankHref = needle
                      ? `/finance/banka?q=${encodeURIComponent(needle)}`
                      : "/finance/banka";

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            className="link"
                            href={`/finance/placanja/${id}`}
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{fmtDate(r.datum)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatAmount(r.iznos_km, locale)}
                        </td>
                        <td style={{ fontWeight: 800 }}>{r.partner ?? "—"}</td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            {t("placanja.banka")}
                          </Link>
                        </td>
                        <td>
                          <div className="subtle">{r.opis ?? "—"}</div>
                          {r.napomena
                            ? <div className="subtle">
                                {t("placanja.napomenaLabel")} {r.napomena}
                              </div>
                            : null}
                        </td>
                        <td className="subtle">{r.status ?? "—"}</td>
                      </tr>
                    );
                  })
                : <tr>
                    <td colSpan={7} className="subtle" style={{ padding: 14 }}>
                      {t("placanja.noResults")}
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
