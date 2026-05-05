import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { query } from "@/lib/db";
import KreditForm from "./KreditForm";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";


/** Za EU (en) nikad ne prikazuj BAM/KM — mapiraj na EUR */
const displayValuta = (valuta, locale) => {
  if (locale !== "en") return valuta ?? "";
  const v = String(valuta ?? "").toUpperCase();
  if (v === "BAM" || v === "KM") return "EUR";
  return valuta ?? "";
};

function fmtMjesecGodina(d) {
  if (!d) return "—";
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${m}.${y}`;
  }
  const raw = String(d).trim();
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[2]}.${isoMatch[1]}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${m}.${y}`;
  }
  return raw;
}

export default async function KreditiPage({ searchParams }) {
  const cols = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'krediti'`,
  ).catch(() => []);
  const colSet = new Set((cols ?? []).map((c) => String(c.column_name)));
  const hasIznosKredita = colSet.has("iznos_kredita");
  const hasKamataTroskovi = colSet.has("iznos_kamata_troskovi");

  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const editId = Number(sp?.edit_id ?? 0);

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
        ${hasIznosKredita ? "iznos_kredita," : "NULL AS iznos_kredita,"}
        ${hasKamataTroskovi ? "iznos_kamata_troskovi," : "NULL AS iznos_kamata_troskovi,"}
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
    const glavnica = Number(r.iznos_kredita ?? 0);
    const kamataTroskovi = Number(r.iznos_kamata_troskovi ?? 0);
    const ukupno = Number(
      r.ukupan_iznos ?? (Number.isFinite(glavnica) && Number.isFinite(kamataTroskovi) ? glavnica + kamataTroskovi : 0),
    );
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
      iznos_kredita: Number.isFinite(glavnica) ? glavnica : null,
      iznos_kamata_troskovi: Number.isFinite(kamataTroskovi) ? kamataTroskovi : null,
      ostalo_rata: ostaloRata,
      ostatak_duga: ostatakDuga,
    };
  });

  const activeList = enriched.filter((r) => r.aktivan !== 0);
  const ukupnoOstatak = activeList.reduce((s, r) => s + (r.ostatak_duga ?? 0), 0);
  const ukupnoOstalihRata = activeList.reduce((s, r) => s + (r.ostalo_rata ?? 0), 0);
  const initialEditCredit =
    Number.isFinite(editId) && editId > 0
      ? enriched.find((r) => Number(r.kredit_id) === editId) ?? null
      : null;

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
                  <div className="brandTitle">{t("krediti.title")}</div>
                  <div className="brandSub">
                    {t("krediti.subtitle")}
                  </div>
                </div>
              </div>

              <div className="actions">
                {locale === "sr" && (
                  <Link className="btn" href="/finance" title={t("finance.title")}>
                    {t("krediti.financeLink")}
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
          {tableMissing && (
            <div className="card" style={{ marginBottom: 12, borderLeft: "4px solid #f59e0b" }}>
              <div className="cardTitle">{t("krediti.tableMissingTitle")}</div>
              <div className="cardSub" style={{ lineHeight: 1.6 }}>
                {t("krediti.tableMissingHint")}{" "}
                <code>{t("krediti.tableMissingCommand")}</code>
              </div>
            </div>
          )}

          {!tableMissing && (
            <>
              <div className="card tableCard" style={{ marginBottom: 14 }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{t("krediti.totalActiveTitle")}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    padding: 16,
                  }}
                >
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      {t("krediti.remainderDebt")}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                      {formatAmount(ukupnoOstatak, locale)}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      {t("krediti.remainingInstalments")}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                      {ukupnoOstalihRata}
                    </div>
                  </div>
                </div>
              </div>

              <KreditForm initialCredit={initialEditCredit} />

              <div className="card tableCard" style={{ marginTop: 14, marginBottom: 14 }}>
                <form method="GET" className="filters" style={{ flexWrap: "wrap", padding: 16 }}>
                  <div className="field">
                    <span className="label">{t("krediti.search")}</span>
                    <input
                      className="input"
                      name="q"
                      defaultValue={q}
                      placeholder={t("krediti.searchPlaceholder")}
                    />
                  </div>
                  <div className="actions">
                    <button type="submit" className="btn btn--active">
                      {t("krediti.apply")}
                    </button>
                    <Link className="btn" href="/finance/krediti">
                      {t("krediti.reset")}
                    </Link>
                  </div>
                </form>
              </div>

              <div className="card tableCard" style={{ marginTop: 14 }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{t("krediti.listTitle")}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span className="muted">{(t("krediti.shownCount") || "").replace("{{count}}", list.length)}</span>
                    <ExportExcelButton
                      filename="krediti"
                      sheetName={t("krediti.excelSheetName")}
                      headers={[t("krediti.colId"), t("krediti.colName"), t("krediti.colBanka"), t("krediti.colIznosKredita"), t("krediti.colKamataTroskovi"), t("krediti.colUkupanIznos"), t("krediti.colValuta"), t("krediti.colBrojRata"), t("krediti.colUplacenoRata"), t("krediti.colOstatakDuga"), t("krediti.colOstaloRata"), t("krediti.colPosljednjaRata"), t("krediti.colActive"), t("krediti.labelNapomena")]}
                      rows={enriched.map((r) => [
                        r.kredit_id,
                        r.naziv ?? "",
                        r.banka_naziv ?? "",
                        r.iznos_kredita ?? "",
                        r.iznos_kamata_troskovi ?? "",
                        r.ukupan_iznos ?? "",
                        displayValuta(r.valuta, locale),
                        r.broj_rata ?? "",
                        r.uplaceno_rata ?? "",
                        r.ostatak_duga ?? "",
                        r.ostalo_rata ?? "",
                        fmtMjesecGodina(r.datum_posljednja_rata),
                        r.aktivan ? t("krediti.yes") : t("krediti.no"),
                        r.napomena ?? "",
                      ])}
                    />
                  </span>
                </div>
                <div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>{t("krediti.colId")}</th>
                        <th>{t("krediti.colName")}</th>
                        <th>{t("krediti.colBanka")}</th>
                        <th className="num" style={{ width: 120 }}>{t("krediti.colIznosKredita")}</th>
                        <th className="num" style={{ width: 130 }}>{t("krediti.colKamataTroskovi")}</th>
                        <th className="num" style={{ width: 110 }}>{t("krediti.colUkupanIznos")}</th>
                        <th className="num" style={{ width: 110 }}>{t("krediti.colBrojRata")}</th>
                        <th className="num" style={{ width: 110 }}>{t("krediti.colUplacenoRata")}</th>
                        <th className="num" style={{ width: 110 }}>{t("krediti.colOstatakDuga")}</th>
                        <th style={{ width: 100 }}>{t("krediti.colOstaloRata")}</th>
                        <th style={{ width: 110 }}>{t("krediti.colPosljednjaRata")}</th>
                        <th style={{ width: 110 }}>{t("krediti.colActions")}</th>
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
                              <td className="num">{r.iznos_kredita != null ? formatAmount(r.iznos_kredita, locale) : "—"}</td>
                              <td className="num">{r.iznos_kamata_troskovi != null ? formatAmount(r.iznos_kamata_troskovi, locale) : "—"}</td>
                              <td className="num">{formatAmount(r.ukupan_iznos, locale)}</td>
                              <td className="num">{r.broj_rata ?? "—"}</td>
                              <td className="num">{r.uplaceno_rata ?? "—"}</td>
                              <td className="num">{formatAmount(r.ostatak_duga, locale)}</td>
                              <td className="num">{r.ostalo_rata}</td>
                              <td className="nowrap">
                                {fmtMjesecGodina(r.datum_posljednja_rata)}
                              </td>
                              <td>
                                <Link className="btn" href={`/finance/krediti?edit_id=${r.kredit_id}`}>
                                  {t("krediti.editButton")}
                                </Link>
                              </td>
                            </tr>
                          ))
                        : (
                            <tr>
                              <td colSpan={12} className="muted" style={{ padding: 16 }}>
                                {t("krediti.noResults")}
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
