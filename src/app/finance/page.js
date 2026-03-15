import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";
import FinanceToolsCard from "./FinanceToolsCard";

export const dynamic = "force-dynamic";

const FINANCE_MODULES = [
  { type: "card", titleKey: "finance.banka", descKey: "finance.bankaDesc", href: "/finance/banka" },
  { type: "card", titleKey: "finance.bankaVsKnjige", descKey: "finance.bankaVsKnjigeDesc", href: "/finance/banka-vs-knjige" },
  { type: "card", titleKey: "finance.cashflow", descKey: "finance.cashflowDesc", href: "/finance/cashflow" },
  { type: "card", titleKey: "finance.dugovanja", descKey: "finance.dugovanjaDesc", href: "/finance/dugovanja" },
  { type: "tools", titleKey: "dashboard.financeTools", descKey: "finance.financeToolsDesc" },
  { type: "card", titleKey: "finance.fiksniTroskovi", descKey: "finance.fiksniTroskoviDesc", href: "/finance/fiksni-troskovi", href2: "/finance/fiksni-troskovi/raspored", href2LabelKey: "finance.raspored" },
  { type: "card", titleKey: "finance.krediti", descKey: "finance.kreditiDesc", href: "/finance/krediti" },
  { type: "card", titleKey: "finance.kuf", descKey: "finance.kufDesc", href: "/finance/kuf" },
  { type: "card", titleKey: "finance.naplate", descKey: "finance.naplateDesc", href: "/naplate" },
  { type: "card", titleKey: "finance.pdvPrijava", descKey: "finance.pdvPrijavaDesc", href: "/finance/pdv" },
  { type: "card", titleKey: "finance.placanja", descKey: "finance.placanjaDesc", href: "/finance/placanja" },
  { type: "card", titleKey: "finance.pocetnaStanja", descKey: "finance.pocetnaStanjaDesc", href: "/finance/pocetna-stanja" },
  { type: "card", titleKey: "finance.potrazivanja", descKey: "finance.potrazivanjaDesc", href: "/finance/potrazivanja" },
  { type: "card", titleKey: "finance.prihodi", descKey: "finance.prihodiDesc", href: "/finance/prihodi" },
];

function FinanceModulesGrid({ t }) {
  const sorted = [...FINANCE_MODULES].sort((a, b) => {
    const titleA = t(a.titleKey);
    const titleB = t(b.titleKey);
    return (titleA || "").localeCompare(titleB || "", "hr");
  });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {sorted.map((m, i) => {
        const title = t(m.titleKey);
        const desc = t(m.descKey);
        const openLabel = t("common.open");
        if (m.type === "tools") {
          return <FinanceToolsCard key={i} title={title} desc={desc} openLabel={openLabel} />;
        }
        return (
          <CardLink
            key={i}
            title={title}
            desc={desc}
            href={m.href}
            href2={m.href2 || null}
            href2Label={m.href2LabelKey ? t(m.href2LabelKey) : undefined}
            openLabel={openLabel}
          />
        );
      })}
    </div>
  );
}

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
                <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("common.dashboard")}
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
      <FinanceModulesGrid t={t} />
        </div>
      </div>
    </div>
  );
}
