import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";
import FinanceModulesGridClient from "./FinanceModulesGridClient";

export const dynamic = "force-dynamic";

const FINANCE_MODULES = [
  { key: "banka", type: "card", titleKey: "finance.banka", descKey: "finance.bankaDesc", href: "/finance/banka", permModule: "Finansije - Banka" },
  { key: "banka", type: "card", titleKey: "finance.bankaVsKnjige", descKey: "finance.bankaVsKnjigeDesc", href: "/finance/banka-vs-knjige", permModule: "Finansije - Banka" },
  { key: "banka", type: "card", titleKey: "finance.cashflow", descKey: "finance.cashflowDesc", href: "/finance/cashflow", permModule: "Finansije - Banka" },
  { key: "dugovanja", type: "card", titleKey: "finance.dugovanja", descKey: "finance.dugovanjaDesc", href: "/finance/dugovanja", permModule: "Finansije - Dugovanja" },
  { key: "banka", type: "tools", titleKey: "dashboard.financeTools", descKey: "finance.financeToolsDesc", permModule: "Finansije - Banka" },
  { key: "dugovanja", type: "card", titleKey: "finance.fiksniTroskovi", descKey: "finance.fiksniTroskoviDesc", href: "/finance/fiksni-troskovi", href2: "/finance/fiksni-troskovi/raspored", href2LabelKey: "finance.raspored", permModule: "Finansije - Dugovanja" },
  { key: "dugovanja", type: "card", titleKey: "finance.krediti", descKey: "finance.kreditiDesc", href: "/finance/krediti", permModule: "Finansije - Dugovanja" },
  { key: "mali_racuni", type: "card", titleKey: "finance.maliRacuni", descKey: "finance.maliRacuniDesc", href: "/finance/mali-racuni", permModule: "Mali računi" },
  { key: "kuf", type: "card", titleKey: "finance.kuf", descKey: "finance.kufDesc", href: "/finance/kuf", permModule: "Finansije - KUF" },
  { key: "osnovna_sredstva", type: "card", titleKey: "finance.osnovnaSredstva", descKey: "finance.osnovnaSredstvaDesc", href: "/finance/osnovna-sredstva", permModule: "Osnovna sredstva" },
  { key: "purs_prijava", type: "card", titleKey: "finance.pursPrijava", descKey: "finance.pursPrijavaDesc", href: "/finance/godisnji-izvjestaj", permModule: "Owner" },
  { key: "pdv", type: "card", titleKey: "finance.pdvPrijava", descKey: "finance.pdvPrijavaDesc", href: "/finance/pdv", permModule: "Finansije - PDV" },
  { key: "dugovanja", type: "card", titleKey: "finance.placanja", descKey: "finance.placanjaDesc", href: "/finance/placanja", permModule: "Finansije - Dugovanja" },
  { key: "pocetna_stanja", type: "card", titleKey: "finance.pocetnaStanja", descKey: "finance.pocetnaStanjaDesc", href: "/finance/pocetna-stanja", permModule: "Finansije - Početno stanje" },
  { key: "potrazivanja", type: "card", titleKey: "finance.potrazivanja", descKey: "finance.potrazivanjaDesc", href: "/finance/potrazivanja", permModule: "Finansije - Potraživanja" },
  { key: "potrazivanja", type: "card", titleKey: "finance.prihodi", descKey: "finance.prihodiDesc", href: "/finance/prihodi", permModule: "Finansije - Potraživanja" },
];

export default async function FinanceHomePage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const tMap = {
    "common.open": t("common.open"),
    "finance.raspored": t("finance.raspored"),
  };
  for (const m of FINANCE_MODULES) {
    tMap[m.titleKey] = t(m.titleKey);
    tMap[m.descKey] = t(m.descKey);
  }

  const sorted = [...FINANCE_MODULES].sort((a, b) => {
    const titleA = tMap[a.titleKey] || "";
    const titleB = tMap[b.titleKey] || "";
    return titleA.localeCompare(titleB, "hr");
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
          <FinanceModulesGridClient modules={sorted} tMap={tMap} />
        </div>
      </div>
    </div>
  );
}
