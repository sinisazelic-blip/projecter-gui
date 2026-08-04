import Link from "next/link";
import { cookies } from "next/headers";
import FluxaLogo from "@/components/FluxaLogo";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { formatAmount } from "@/lib/format";
import { getLastMonthRange, getPdvPrijavaData } from "@/lib/pdv-prijava";
import { isFakturaPlacenaStatus } from "@/lib/invoicePaidStatus";
import PdvYearPopup from "./PdvYearPopup";

export const dynamic = "force-dynamic";

const fmtDate = (s) => {
  if (!s || typeof s !== "string") return "—";
  const part = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return "—";
  const [y, m, d] = part.split("-");
  return `${d}.${m}.${y}`;
};

export default async function PdvPrijavaPage({ searchParams }) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const sp = await Promise.resolve(searchParams);
  const prosliMjesec = sp?.prosli_mjesec === "1" || sp?.prošli_mjesec === "1";
  const excludePaidKif = sp?.exclude_paid === "1" || sp?.bez_placenih === "1";
  let from = (sp?.from ?? "").trim();
  let to = (sp?.to ?? "").trim();
  if (prosliMjesec) {
    const range = getLastMonthRange();
    from = range.from;
    to = range.to;
  }
  const data = await getPdvPrijavaData(from || null, to || null, { excludePaidKif });
  const { from: dataFrom, to: dataTo, summary, credit, kif, kuf, kif_filter_exclude_paid: kifFiltered } = data;

  const saldoMjeseca = summary.za_prijavu_km;
  const showCredit = credit?.is_full_month;
  const netoZaUplatu = showCredit ? credit.za_uplatu_km : null;
  const pretplataKraj = showCredit ? credit.pretplata_km : null;
  const preneto = showCredit ? credit.preneto_km : 0;
  const isPretplataSaldo = saldoMjeseca < -0.004;
  const isPretplataNeto = showCredit && pretplataKraj > 0.004;
  const isUplataNeto = showCredit && netoZaUplatu > 0.004;

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
                  <div className="brandTitle">{t("pdv.title")}</div>
                  <div className="brandSub">{t("pdv.subtitle")}</div>
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
          {/* Filter perioda */}
          <div
            className="card"
            style={{
              marginBottom: 20,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <form
              method="get"
              action="/finance/pdv"
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="subtle" style={{ fontSize: 12 }}>{t("pdv.from")}</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={dataFrom}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="subtle" style={{ fontSize: 12 }}>{t("pdv.to")}</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={dataTo}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 4,
                }}
              >
                <input type="checkbox" name="exclude_paid" value="1" defaultChecked={excludePaidKif} />
                <span className="subtle" style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.35 }}>
                  {t("pdv.excludePaidKif")}
                </span>
              </label>
              <button type="submit" className="btn btn--active" style={{ padding: "8px 16px" }}>
                {t("pdv.refresh")}
              </button>
              <Link
                href={`/finance/pdv?prosli_mjesec=1${excludePaidKif ? "&exclude_paid=1" : ""}`}
                className="btn"
                style={{ padding: "8px 16px" }}
              >
                {t("pdv.lastMonth")}
              </Link>
              <Link
                href={`/finance/pdv/obrazac?from=${encodeURIComponent(dataFrom)}&to=${encodeURIComponent(dataTo)}`}
                className="btn btn--orange-accent"
                style={{ padding: "8px 16px" }}
                title={t("pdv.obrazacTitle")}
              >
                {t("pdv.obrazac")}
              </Link>
              <PdvYearPopup
                initialYear={Number(String(dataFrom).slice(0, 4)) || new Date().getFullYear()}
                locale={locale}
              />
            </form>
            {kifFiltered ? (
              <div className="subtle" style={{ marginTop: 12, fontSize: 12, lineHeight: 1.45 }}>
                {t("pdv.excludePaidKifHint")}
              </div>
            ) : null}
          </div>

          {/* Obračun – rezime */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 12, color: "var(--muted)" }}>
              Period: {fmtDate(dataFrom)} – {fmtDate(dataTo)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
              <div>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>{t("pdv.izlazniPdv")}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatAmount(summary.pdv_izlazni_km, locale)}</div>
              </div>
              <div>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>{t("pdv.ulazniPdv")}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatAmount(summary.pdv_ulazni_km, locale)}</div>
              </div>
              <div style={{ padding: "8px 0", paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
                <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>{t("pdv.saldoMjeseca")}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: isPretplataSaldo ? "var(--accent)" : undefined,
                  }}
                >
                  {formatAmount(saldoMjeseca, locale)}
                </div>
                <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                  {isPretplataSaldo ? t("pdv.saldoPretplataHint") : t("pdv.saldoUplataHint")}
                </div>
              </div>
              {showCredit ? (
                <>
                  <div>
                    <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>{t("pdv.preneto")}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{formatAmount(preneto, locale)}</div>
                    <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>{t("pdv.prenetoHint")}</div>
                  </div>
                  <div style={{ padding: "8px 0", paddingLeft: 12, borderLeft: "2px solid var(--accent)" }}>
                    <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>
                      {isPretplataNeto ? t("pdv.pretplata") : t("pdv.zaUplatu")}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>
                      {formatAmount(isPretplataNeto ? pretplataKraj : netoZaUplatu, locale)}
                    </div>
                    <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                      {isPretplataNeto
                        ? t("pdv.pretplataHint")
                        : isUplataNeto
                          ? t("pdv.zaUplatuHint")
                          : t("pdv.nulaHint")}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            {!showCredit ? (
              <div className="subtle" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.45 }}>
                {t("pdv.creditOnlyFullMonth")}
              </div>
            ) : null}
          </div>

          {/* KIF – dokumenti izlazni PDV */}
          <div
            className="card"
            style={{
              marginBottom: 24,
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
              Dokumenti – izlazni PDV (KIF)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Broj</th>
                    <th>Datum</th>
                    <th>Kupac / Naručilac</th>
                    <th style={{ textAlign: "right" }}>{t("pdv.colOsnovica")}</th>
                    <th style={{ textAlign: "right" }}>{t("pdv.colPdv")}</th>
                    <th style={{ textAlign: "right" }}>{t("pdv.colUkupno")}</th>
                    <th>{t("pdv.colNaplata")}</th>
                  </tr>
                </thead>
                <tbody>
                  {kif.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        {t("pdv.noDocuments")}
                      </td>
                    </tr>
                  ) : (
                    kif.map((r) => (
                      <tr key={r.id ?? r.broj}>
                        <td>
                          {r.id && !r.iz_arhive ? (
                            <Link href={`/fakture/${r.id}/preview`} className="link">
                              {r.broj}
                            </Link>
                          ) : (
                            <>{r.broj}</>
                          )}
                          {r.iz_arhive ? " (arh.)" : ""}
                        </td>
                        <td>{fmtDate(r.datum)}</td>
                        <td>{r.kupac}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.osnovica_km, locale)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.pdv_km, locale)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.ukupno_km, locale)}</td>
                        <td className="subtle" style={{ fontSize: 12 }}>
                          {r.iz_arhive
                            ? "—"
                            : isFakturaPlacenaStatus(r.fiskalni_status)
                              ? t("pdv.statusPlaceno")
                              : t("pdv.statusNeplaceno")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KUF – dokumenti ulazni PDV */}
          <div
            className="card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
              {t("pdv.dokumentiUlazni")}
            </div>
            <div className="subtle" style={{ padding: "8px 14px", fontSize: 12 }}>
              {t("pdv.ulazniPdvHint")}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Broj</th>
                    <th>Datum</th>
                    <th>Partner</th>
                    <th style={{ textAlign: "right" }}>Osnovica (KM)</th>
                    <th style={{ textAlign: "right" }}>PDV ulazni (KM)</th>
                    <th style={{ textAlign: "right" }}>Ukupno (KM)</th>
                  </tr>
                </thead>
                <tbody>
                  {kuf.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="subtle" style={{ padding: 24, textAlign: "center" }}>
                        Nema dokumenata u izabranom periodu.
                      </td>
                    </tr>
                  ) : (
                    kuf.map((r) => (
                      <tr key={r.id}>
                        <td>{r.broj}</td>
                        <td>{fmtDate(r.datum)}</td>
                        <td>{r.partner}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.osnovica_km, locale)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.pdv_km, locale)}</td>
                        <td style={{ textAlign: "right" }}>{formatAmount(r.ukupno_km, locale)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
