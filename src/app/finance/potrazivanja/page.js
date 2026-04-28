import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatReportNum, toIsoDate } from "@/lib/format";
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

function agingBucket(daysOverdue) {
  if (daysOverdue <= 0) return "0-30";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

function fmtCurrencySuffix(valuta, locale) {
  const v = String(valuta || "").trim().toUpperCase();
  if (!v) return locale === "en" ? " EUR" : " KM";
  if (v === "BAM" || v === "KM") return locale === "en" ? " EUR" : " KM";
  return ` ${v}`;
}

function fmtMoney(value, valuta, locale) {
  const n = Number(value);
  const num = Number.isFinite(n) ? n : 0;
  return formatReportNum(num, locale) + fmtCurrencySuffix(valuta, locale);
}

export default async function PotrazivanjaListPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const q = (sp?.q ?? "").trim();
  const onlyOpen = sp?.only_open === "1";
  const showOpening = sp?.show_opening === "1";
  const dateFrom = (sp?.date_from ?? "").trim(); // YYYY-MM-DD
  const dateTo = (sp?.date_to ?? "").trim(); // YYYY-MM-DD

  let pocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };
  try {
    pocetnaStanja = await getPocetnaStanja();
  } catch {
    // ignore
  }
  const aktivnaPocetnaKlijenti = (pocetnaStanja.klijenti || []).filter(
    (r) =>
      !r?.otpisano &&
      Number(r?.remaining_km ?? r?.iznos_km ?? 0) > 0.001,
  );

  // Potraživanja: primarno iz faktura (izdate fakture = potraživanja),
  // status plaćanja iz fiskalni_status (PLACENA/DJELIMICNO).
  const where = ["(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))"];
  const params = [];

  if (q) {
    where.push(
      "(CAST(f.faktura_id AS CHAR) LIKE ? OR f.broj_fakture_puni LIKE ? OR k.naziv_klijenta LIKE ?)",
    );
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (dateFrom) {
    where.push("f.datum_izdavanja >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    // include whole day
    where.push("f.datum_izdavanja <= ?");
    params.push(`${dateTo} 23:59:59`);
  }

  if (onlyOpen) {
    where.push("(f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA', 'DJELIMICNO'))");
  }

  let rows = [];
  let dbError = null;
  try {
    rows = await query(
      `
      SELECT
        f.faktura_id,
        f.broj_fakture_puni AS broj_fakture,
        DATE(f.datum_izdavanja) AS datum_izdavanja,
        f.bill_to_klijent_id AS narucilac_id,
        k.naziv_klijenta AS narucilac_naziv,
        COALESCE(k.rok_placanja_dana, 0) AS rok_placanja_dana,
        f.iznos_ukupno_km AS iznos_sa_pdv,
        f.valuta,
        f.fiskalni_status
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      WHERE ${where.join(" AND ")}
      ORDER BY f.datum_izdavanja DESC, f.faktura_id DESC
      LIMIT 2000
      `,
      params,
    );
  } catch (e) {
    dbError = e?.message || String(e);
    rows = [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const list = (Array.isArray(rows) ? rows : []).map((r) => {
    const iso = toIsoDate(r.datum_izdavanja);
    const rokDana = Number(r.rok_placanja_dana) || 0;
    let dueIso = null;
    if (iso) {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() + rokDana);
      dueIso = d.toISOString().slice(0, 10);
    }
    const due = dueIso ? new Date(dueIso) : null;
    due?.setHours(0, 0, 0, 0);
    const daysOverdue =
      due && due < today
        ? Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))
        : 0;

    const iznos = Number(r.iznos_sa_pdv) || 0;
    const isPaid = ["PLACENA", "DJELIMICNO"].includes(String(r.fiskalni_status || "").toUpperCase());
    const paid = isPaid ? iznos : 0;
    const unpaid = isPaid ? 0 : iznos;

    return {
      faktura_id: r.faktura_id,
      broj_fakture: r.broj_fakture,
      datum_izdavanja: iso,
      datum_dospijeca: dueIso,
      narucilac_naziv: r.narucilac_naziv || "—",
      iznos,
      valuta: r.valuta || "BAM",
      fiskalni_status: r.fiskalni_status,
      paid_km: paid,
      unpaid_km: unpaid,
      days_overdue: daysOverdue,
      aging_bucket: agingBucket(daysOverdue),
    };
  });

  // Napomena: iznosi mogu biti u više valuta (BAM/EUR). Ne sabiramo preko valuta.
  const bucketSums = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of list) {
    // bucketSums ostaje informativan samo za BAM (legacy). Zadržano radi kompatibilnosti.
    if (String(r.valuta || "").toUpperCase() === "BAM") {
      bucketSums[r.aging_bucket] = (bucketSums[r.aging_bucket] || 0) + (Number(r.unpaid_km) || 0);
    }
  }
  const ukupnoNeplaceno = list.reduce((s, r) => {
    // zbir preko BAM samo (da ne miješamo valute u jedan broj)
    if (String(r.valuta || "").toUpperCase() !== "BAM") return s;
    return s + (Number(r.unpaid_km) || 0);
  }, 0);

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
      {dbError && (
        <div className="card" style={{ marginBottom: 12, borderColor: "rgba(248,113,113,.35)" }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontWeight: 700, color: "#f87171" }}>{t("common.error") || "Greška"}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {String(dbError)}
            </div>
          </div>
        </div>
      )}
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

          <div className="field">
            <span className="label">{t("potrazivanja.period")}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="input"
                type="date"
                name="date_from"
                defaultValue={dateFrom}
                style={{ width: "auto" }}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                {t("potrazivanja.to")}
              </span>
              <input
                className="input"
                type="date"
                name="date_to"
                defaultValue={dateTo}
                style={{ width: "auto" }}
              />
            </div>
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

          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="show_opening"
              value="1"
              defaultChecked={showOpening}
            />
            <span className="label" style={{ marginBottom: 0 }}>{t("potrazivanja.showOpening")}</span>
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
      {showOpening && aktivnaPocetnaKlijenti.length > 0 && (
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
                  {aktivnaPocetnaKlijenti.map((r) => (
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
            <span className="muted">
              {(t("potrazivanja.shownCount") || "").replace("{{count}}", list.length)}
              {` · ${(t("potrazivanja.ukupnoAktivna") || "Ukupno neplaćeno (BAM)")}: ${fmtMoney(ukupnoNeplaceno, "BAM", locale)}`}
            </span>
            <ExportExcelButton
              filename="potrazivanja"
              sheetName={t("potrazivanja.excelSheetName")}
              headers={[
                t("potrazivanja.colId"),
                t("potrazivanja.colDatum"),
                t("potrazivanja.colDospijece"),
                t("potrazivanja.colIznos"),
                t("potrazivanja.colPlaceno"),
                t("potrazivanja.colPreostalo"),
                t("potrazivanja.colOpis"),
                t("potrazivanja.colValuta") || "Valuta",
              ]}
              rows={list.map((r) => {
                const rem = Number(r.unpaid_km) || 0;
                return [
                  r.faktura_id ?? "",
                  r.datum_izdavanja ? fmtDate(r.datum_izdavanja) : "—",
                  r.datum_dospijeca ? fmtDate(r.datum_dospijeca) : "—",
                  r.iznos,
                  r.paid_km,
                  rem,
                  `${r.narucilac_naziv} · ${r.broj_fakture ?? "—"}`,
                  String(r.valuta || "BAM"),
                ];
              })}
            />
          </span>
        </div>
        <div style={{ overflowX: "auto" }} className="potrazivanja-table-wrap">
          <table className="table potrazivanja-table" style={{ width: "100%", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t("potrazivanja.colId")}</th>
                <th>{t("potrazivanja.colDatum")}</th>
                <th>{t("potrazivanja.colDospijece")}</th>
                <th>{t("potrazivanja.colOpis")}</th>
                <th className="num">{t("potrazivanja.colIznos")}</th>
                <th className="num">{t("potrazivanja.colPlaceno")}</th>
                <th className="num">{t("potrazivanja.colPreostalo")}</th>
                <th>{t("potrazivanja.status") || "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {list.length
                ? list.map((r) => {
                    const id = r.faktura_id;
                    const iznos = Number(r.iznos) || 0;
                    const paid = Number(r.paid_km) || 0;
                    const rem = Number(r.unpaid_km) || 0;
                    const statusTxt = String(r.fiskalni_status || "").toUpperCase() || "—";

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            className="link"
                            href={`/fakture/${id}`}
                          >
                            {id}
                          </Link>
                        </td>
                        <td>{r.datum_izdavanja ? fmtDate(r.datum_izdavanja) : "—"}</td>
                        <td>{r.datum_dospijeca ? fmtDate(r.datum_dospijeca) : "—"}</td>
                        <td
                          style={{
                            maxWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                            title={`${r.narucilac_naziv} — ${r.broj_fakture ?? "—"}`}
                          >
                            {r.narucilac_naziv} · {r.broj_fakture ?? "—"}
                          </div>
                          <div className="subtle" style={{ fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {r.days_overdue > 0 ? badge(`kasni ${r.days_overdue}d`, "bad") : badge(r.aging_bucket, "neutral")}
                          </div>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtMoney(iznos, r.valuta, locale)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtMoney(paid, r.valuta, locale)}
                        </td>
                        <td>
                          {fmtMoney(rem, r.valuta, locale)}
                        </td>
                        <td>{statusTxt}</td>
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
