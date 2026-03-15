import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import FiksniTroskoviClient from "./FiksniTroskoviClient";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export default async function FiksniTroskoviPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();

  const where = [];
  const params = [];

  if (q) {
    where.push("(CAST(f.trosak_id AS CHAR) LIKE ? OR f.naziv_troska LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query(
    `
    SELECT
      f.trosak_id,
      f.naziv_troska,
      f.frekvencija,
      f.dan_u_mjesecu,
      f.datum_dospijeca,
      f.zadnje_placeno,
      f.iznos,
      f.valuta,
      f.aktivan
    FROM fiksni_troskovi f
    ${whereSql}
    ORDER BY f.aktivan DESC, f.trosak_id DESC
    LIMIT 200
    `,
    params,
  ).catch(async () => {
    return await query(
      `
      SELECT *
      FROM fiksni_troskovi
      ${whereSql}
      ORDER BY trosak_id DESC
      LIMIT 200
      `,
      params,
    );
  });

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
                  <div className="brandTitle">{t("fiksniTroskovi.title")}</div>
                  <div className="brandSub">{t("fiksniTroskovi.subtitlePage")}</div>
                </div>
              </div>

              <div className="actions">
                <Link className="btn" href="/finance/cashflow" title={t("fiksniTroskovi.cashflowTitle")}>
                  {t("cashflow.title")}
                </Link>
                <Link className="btn" href="/finance/fiksni-troskovi/raspored">
                  {t("fiksniTroskovi.schedule")}
                </Link>
                {locale === "sr" && (
                  <Link className="btn" href="/finance" title={t("finance.title")}>
                    {t("finance.title")}
                  </Link>
                )}
                <Link className="btn" href="/dashboard" title={t("common.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div className="card tableCard" style={{ marginBottom: 14 }}>
        <form className="card-row" method="GET" style={{ gap: 12, padding: 16 }}>
          <div style={{ minWidth: 260 }}>
            <div className="label">{t("fiksniTroskovi.search")}</div>
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder={t("fiksniTroskovi.searchPlaceholder")}
            />
          </div>
          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button className="btn btn--active" type="submit">
              {t("fiksniTroskovi.apply")}
            </button>
            <Link className="btn" href="/finance/fiksni-troskovi">
              {t("fiksniTroskovi.reset")}
            </Link>
          </div>
        </form>
      </div>

      <FiksniTroskoviClient initialRows={rows ?? []} />

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t("fiksniTroskovi.note")}</div>
        <div className="subtle" style={{ lineHeight: 1.6, fontSize: 13 }}>
          {t("fiksniTroskovi.noteReadOnly")}{" "}
          <Link href="/finance/fiksni-troskovi/raspored" className="btn" style={{ display: "inline-flex" }}>
            {t("fiksniTroskovi.scheduleLink")}
          </Link>
          . {t("fiksniTroskovi.noteLater")}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
