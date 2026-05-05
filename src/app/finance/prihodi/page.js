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
  const godina = (sp?.godina ?? "").trim();
  const metricYearRaw = (sp?.metric_year ?? "").trim();
  const currentYear = new Date().getFullYear();
  const metricYear = Number(metricYearRaw || godina || currentYear);
  const selectedMetricYear = Number.isFinite(metricYear) && metricYear > 2000 ? metricYear : currentYear;

  let rows = null;

  try {
    const where = [];
    const params = [];

    if (projekatId) {
      where.push("projekat_id = ?");
      params.push(Number(projekatId));
    }
    if (godina) {
      where.push("YEAR(COALESCE(datum_prihoda, datum)) = ?");
      params.push(Number(godina));
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
      SELECT prihod_id, projekat_id, COALESCE(datum_prihoda, datum) AS datum, iznos_km, opis, napomena, status
      FROM projektni_prihodi
      ${whereSql}
      ${where.length ? "AND" : "WHERE"} COALESCE(status, 'ACTIVE') <> 'STORNO'
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
  const evidentiranoUkupno = list.reduce((s, r) => s + (Number(r?.iznos_km) || 0), 0);

  const faktureWhere = [];
  const faktureParams = [];
  faktureWhere.push("(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))");
  if (godina) {
    faktureWhere.push("YEAR(f.datum_izdavanja) = ?");
    faktureParams.push(Number(godina));
  }
  const faktureSql = faktureWhere.length ? `WHERE ${faktureWhere.join(" AND ")}` : "";
  const faktureSummaryRows = await query(
    `
    SELECT
      COUNT(*) AS broj_faktura,
      COALESCE(SUM(f.iznos_ukupno_km), 0) AS ukupno_fakturisano_km
    FROM fakture f
    ${faktureSql}
    `,
    faktureParams,
  ).catch(() => [{ broj_faktura: 0, ukupno_fakturisano_km: 0 }]);
  const brojFaktura = Number(faktureSummaryRows?.[0]?.broj_faktura ?? 0);
  const ukupnoFakturisanoKm = Number(faktureSummaryRows?.[0]?.ukupno_fakturisano_km ?? 0);

  const yearsRows = await query(
    `
    SELECT y AS godina FROM (
      SELECT YEAR(f.datum_izdavanja) AS y FROM fakture f WHERE f.datum_izdavanja IS NOT NULL
      UNION
      SELECT YEAR(b.value_date) AS y FROM bank_tx_posting b WHERE b.value_date IS NOT NULL
      UNION
      SELECT YEAR(c.datum) AS y FROM blagajna_stavke c WHERE c.datum IS NOT NULL
    ) u
    WHERE y IS NOT NULL
    ORDER BY y DESC
    `,
  ).catch(() => []);
  const metricYearOptions = Array.from(
    new Set(
      [currentYear, ...(yearsRows ?? []).map((r) => Number(r.godina)).filter((y) => Number.isFinite(y) && y > 2000)],
    ),
  ).sort((a, b) => b - a);

  const monthNames = [
    t("financeTools.monthJan") || "Januar",
    t("financeTools.monthFeb") || "Februar",
    t("financeTools.monthMar") || "Mart",
    t("financeTools.monthApr") || "April",
    t("financeTools.monthMaj") || "Maj",
    t("financeTools.monthJun") || "Jun",
    t("financeTools.monthJul") || "Jul",
    t("financeTools.monthAug") || "Avgust",
    t("financeTools.monthSep") || "Septembar",
    t("financeTools.monthOct") || "Oktobar",
    t("financeTools.monthNov") || "Novembar",
    t("financeTools.monthDec") || "Decembar",
  ];

  const faktureByMonthRows = await query(
    `
    SELECT MONTH(f.datum_izdavanja) AS m, COALESCE(SUM(f.iznos_ukupno_km), 0) AS s
    FROM fakture f
    WHERE YEAR(f.datum_izdavanja) = ?
      AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    GROUP BY MONTH(f.datum_izdavanja)
    `,
    [selectedMetricYear],
  ).catch(() => []);
  const faktureByMonth = new Map(
    (faktureByMonthRows ?? []).map((r) => [Number(r.m), Number(r.s) || 0]),
  );

  const troskoviByMonthRows = await query(
    `
    SELECT inv.m AS m, COALESCE(SUM(pt.iznos_km), 0) AS s
    FROM (
      SELECT DISTINCT MONTH(f.datum_izdavanja) AS m, fp.projekat_id
      FROM fakture f
      JOIN faktura_projekti fp ON fp.faktura_id = f.faktura_id
      WHERE YEAR(f.datum_izdavanja) = ?
        AND (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
    ) inv
    LEFT JOIN projektni_troskovi pt
      ON pt.projekat_id = inv.projekat_id
     AND YEAR(pt.datum_troska) = ?
     AND MONTH(pt.datum_troska) = inv.m
     AND COALESCE(pt.status, '') <> 'STORNIRANO'
    GROUP BY inv.m
    `,
    [selectedMetricYear, selectedMetricYear],
  ).catch(() => []);
  const troskoviByMonth = new Map(
    (troskoviByMonthRows ?? []).map((r) => [Number(r.m), Number(r.s) || 0]),
  );

  const bankaNaplateRows = await query(
    `
    SELECT
      MONTH(b.value_date) AS m,
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(b.currency, ''))) = 'EUR' THEN b.amount * 1.95
          ELSE b.amount
        END
      ), 0) AS s
    FROM bank_tx_posting b
    WHERE YEAR(b.value_date) = ?
      AND b.amount > 0
      AND (b.reversed_at IS NULL AND (b.reversed_by_batch_id IS NULL OR b.reversed_by_batch_id = 0))
    GROUP BY MONTH(b.value_date)
    `,
    [selectedMetricYear],
  ).catch(() => []);
  const bankaNaplateByMonth = new Map(
    (bankaNaplateRows ?? []).map((r) => [Number(r.m), Number(r.s) || 0]),
  );

  const blagajnaNaplateRows = await query(
    `
    SELECT MONTH(c.datum) AS m, COALESCE(SUM(c.iznos), 0) AS s
    FROM blagajna_stavke c
    WHERE YEAR(c.datum) = ?
      AND c.smjer = 'IN'
      AND COALESCE(c.status, 'AKTIVAN') = 'AKTIVAN'
    GROUP BY MONTH(c.datum)
    `,
    [selectedMetricYear],
  ).catch(() => []);
  const blagajnaNaplateByMonth = new Map(
    (blagajnaNaplateRows ?? []).map((r) => [Number(r.m), Number(r.s) || 0]),
  );

  const monthNums = Array.from({ length: 12 }, (_, i) => i + 1);
  const rowProfitNow = monthNums.map((m) => {
    const fakt = faktureByMonth.get(m) ?? 0;
    const trosk = troskoviByMonth.get(m) ?? 0;
    return fakt - trosk;
  });
  const rowDeferred = monthNums.map((m) => {
    const fakt = faktureByMonth.get(m) ?? 0;
    const naplate = (bankaNaplateByMonth.get(m) ?? 0) + (blagajnaNaplateByMonth.get(m) ?? 0);
    return fakt - naplate;
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
                  <div className="brandTitle">{t("prihodi.title")}</div>
                  <div className="brandSub">{t("prihodi.subtitle")}</div>
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

          <div className="field">
            <span className="label">{t("prihodi.godina")}</span>
            <input
              className="input"
              name="godina"
              defaultValue={godina}
              placeholder={t("prihodi.godinaPlaceholder")}
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

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("prihodi.sourceTitle")}</div>
        <div className="subtle" style={{ lineHeight: 1.6 }}>
          {t("prihodi.sourceDescription")}
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <div className="subtle" style={{ fontSize: 12 }}>{t("prihodi.evidentiranoUkupno")}</div>
            <div style={{ fontWeight: 800 }}>{formatAmount(evidentiranoUkupno, locale)}</div>
          </div>
          <div>
            <div className="subtle" style={{ fontSize: 12 }}>{t("prihodi.fakturisanoUkupno")}</div>
            <div style={{ fontWeight: 800 }}>{formatAmount(ukupnoFakturisanoKm, locale)}</div>
          </div>
          <div>
            <div className="subtle" style={{ fontSize: 12 }}>{t("prihodi.brojFaktura")}</div>
            <div style={{ fontWeight: 800 }}>{brojFaktura}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <form method="GET" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="projekat_id" value={projekatId} />
          <input type="hidden" name="godina" value={godina} />
          <div>
            <div className="label">{t("prihodi.metricYearLabel")}</div>
            <select className="input" name="metric_year" defaultValue={String(selectedMetricYear)} style={{ minWidth: 140 }}>
              {metricYearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn--active">{t("prihodi.apply")}</button>
        </form>
        <div className="table-wrap">
          <table className="table" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: 290 }}>{t("prihodi.metricFormula")}</th>
                {monthNames.map((mn, idx) => (
                  <th key={`${mn}-${idx}`} className="num">{mn}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }} title={t("prihodi.metricRowProfitNowTooltip")}>
                  {t("prihodi.metricRowProfitNow")}
                </td>
                {rowProfitNow.map((v, idx) => (
                  <td key={`p-${idx}`} className="num">{formatAmount(v, locale)}</td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }} title={t("prihodi.metricRowDeferredTooltip")}>
                  {t("prihodi.metricRowDeferred")}
                </td>
                {rowDeferred.map((v, idx) => (
                  <td key={`d-${idx}`} className="num">{formatAmount(v, locale)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
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
