import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

function CardLink({ title, desc, href, href2, href2Label, openLabel }) {
  return (
    <div
      className="card"
      style={{
        margin: 0,
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        boxShadow: "var(--shadow)",
        padding: 18,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div className="subtle" style={{ lineHeight: 1.6, marginBottom: 14, fontSize: 13 }}>
        {desc}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn btn--active" href={href} style={{ padding: "10px 16px" }}>
          {openLabel}
        </Link>
        {href2 ? (
          <Link className="btn" href={href2} style={{ padding: "10px 16px" }}>
            {href2Label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function FinanceHomePage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

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
                  <div className="brandTitle">{t("finance.title")}</div>
                  <div className="brandSub">{t("finance.subtitle")}</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                🏠 {t("common.dashboard")}
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <CardLink
          title={t("finance.banka")}
          desc={t("finance.bankaDesc")}
          href="/finance/banka"
          openLabel={t("common.open")}
        />

        <CardLink title={t("finance.bankaVsKnjige")} desc={t("finance.bankaVsKnjigeDesc")} href="/finance/banka-vs-knjige" openLabel={t("common.open")} />
        <CardLink title={t("finance.potrazivanja")} desc={t("finance.potrazivanjaDesc")} href="/finance/potrazivanja" openLabel={t("common.open")} />
        <CardLink title={t("finance.naplate")} desc={t("finance.naplateDesc")} href="/naplate" openLabel={t("common.open")} />
        <CardLink title={t("finance.pdvPrijava")} desc={t("finance.pdvPrijavaDesc")} href="/finance/pdv" openLabel={t("common.open")} />
        <CardLink title={t("finance.kuf")} desc={t("finance.kufDesc")} href="/finance/kuf" openLabel={t("common.open")} />
        <CardLink title={t("dashboard.financeTools")} desc={t("finance.financeToolsDesc")} href="/studio/finance-tools" openLabel={t("common.open")} />
        <CardLink title={t("finance.pocetnaStanja")} desc={t("finance.pocetnaStanjaDesc")} href="/finance/pocetna-stanja" openLabel={t("common.open")} />
        <CardLink title={t("finance.dugovanja")} desc={t("finance.dugovanjaDesc")} href="/finance/dugovanja" openLabel={t("common.open")} />
        <CardLink title={t("finance.prihodi")} desc={t("finance.prihodiDesc")} href="/finance/prihodi" openLabel={t("common.open")} />
        <CardLink title={t("finance.placanja")} desc={t("finance.placanjaDesc")} href="/finance/placanja" openLabel={t("common.open")} />
        <CardLink title={t("finance.cashflow")} desc={t("finance.cashflowDesc")} href="/finance/cashflow" openLabel={t("common.open")} />
        <CardLink title={t("finance.krediti")} desc={t("finance.kreditiDesc")} href="/finance/krediti" openLabel={t("common.open")} />
        <CardLink
          title={t("finance.fiksniTroskovi")}
          desc={t("finance.fiksniTroskoviDesc")}
          href="/finance/fiksni-troskovi"
          href2="/finance/fiksni-troskovi/raspored"
          href2Label={t("finance.raspored")}
          openLabel={t("common.open")}
        />
      </div>

      <div
        className="card"
        style={{
          marginTop: 20,
          gridColumn: "1 / -1",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t("finance.note")}</div>
        <div className="subtle" style={{ lineHeight: 1.7, fontSize: 13 }}>
          {t("finance.noteText")}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
