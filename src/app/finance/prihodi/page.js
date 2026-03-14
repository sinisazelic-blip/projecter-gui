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
  const s = (row?.opis || row?.napomena || "").toString().trim();
  if (!s) return "";
  return s.length > 40 ? s.slice(0, 40) : s;
}

export default async function PrihodiListPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

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
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("prihodi.title")}</div>
                  <div className="brandSub">{t("prihodi.subtitle")}</div>
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
            <span className="label">{t("prihodi.search")}</span>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder={t("prihodi.searchPlaceholder")}
            />
          </div>

          <div className="field">
            <span className="label">{t("prihodi.projekatId")}</span>
            <input
              className="input"
              name="projekat_id"
              defaultValue={projekatId}
              placeholder={t("prihodi.projekatIdPlaceholder")}
            />
          </div>

          <div className="actions">
            <button className="btn btn--active" type="submit">
              {t("prihodi.apply")}
            </button>
            <Link className="btn" href="/finance/prihodi">
              {t("prihodi.reset")}
            </Link>
          </div>
        </form>
      </div>

      <div className="card tableCard">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("prihodi.listTitle")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="muted">{(t("prihodi.shownCount") || "").replace("{{count}}", list.length)}</span>
            <ExportExcelButton
              filename="prihodi"
              sheetName={t("prihodi.excelSheetName")}
              headers={[t("prihodi.colId"), t("prihodi.colProjekat"), t("prihodi.colDatum"), t("prihodi.colIznos"), t("prihodi.colOpis"), "Napomena", t("prihodi.colStatus")]}
              rows={list.map((r) => [
                r.prihod_id ?? r.id,
                r.projekat_id ?? "",
                fmtDate(r.datum),
                r.iznos_km ?? "",
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
                <th style={{ width: 120 }}>{t("prihodi.colId")}</th>
                <th style={{ width: 120 }}>{t("prihodi.colProjekat")}</th>
                <th style={{ width: 140 }}>{t("prihodi.colDatum")}</th>
                <th style={{ width: 170, textAlign: "right" }}>{t("prihodi.colIznos")}</th>
                <th style={{ width: 110 }}>{t("prihodi.colBanka")}</th>
                <th>{t("prihodi.colOpis")}</th>
                <th style={{ width: 120 }}>{t("prihodi.colStatus")}</th>
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
                          {formatAmount(r.iznos_km, locale)}
                        </td>
                        <td>
                          <Link className="btn" href={bankHref}>
                            {t("prihodi.banka")}
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
                      {t("prihodi.noResults")}
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
