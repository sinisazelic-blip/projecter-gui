"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { FluxaFeature } from "@/components/FluxaFeature";
import FinanceMorePopup from "./FinanceMorePopup";

function ActionBtn({ label, href, title, icon, className = "" }) {
  const content = icon ? `${icon} ${label}` : label;
  if (!href) {
    return (
      <span className={`btn btn--disabled ${className}`} aria-disabled="true" title={title}>
        {content}
      </span>
    );
  }
  return (
    <Link className={`btn ${className}`} href={href} title={title || label}>
      {content}
    </Link>
  );
}

export default function DashboardBody() {
  const { t } = useTranslation();
  return (
    <>
      <div className="dashboardGroup deskGroup">
        <div className="groupHeader">
          <div className="groupTitle">{t("dashboard.desk")}</div>
        </div>
        <div className="deskMainButtons">
          <FluxaFeature id={7}>
            <Link
                    href="/inicijacije"
                    className="deskMainBtn deskMainBtn--blue"
                    title={t("dashboard.dealsTitle")}
                  >
                    <span style={{ fontSize: 28 }}>📋</span>
                    <span>{t("dashboard.deals")}</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.dealsSubtitle")}</span>
            </Link>
          </FluxaFeature>
          <FluxaFeature id={9}>
            <Link
              href="/studio/strategic-core"
                    className="deskMainBtn deskMainBtn--sc"
                    title={t("dashboard.strategicCoreTitle")}
                  >
                    <span>{t("dashboard.sc")}®</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.strategicCore")}</span>
            </Link>
          </FluxaFeature>
          <FluxaFeature id={8}>
            <Link
              href="/projects"
                    className="deskMainBtn deskMainBtn--green"
                    title={t("dashboard.ppTitle")}
                  >
                    <span style={{ fontSize: 28 }}>📊</span>
                    <span>{t("dashboard.pp")}</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.ppSubtitle")}</span>
            </Link>
          </FluxaFeature>
        </div>
      </div>

      <FluxaFeature id={10}>
        <div className="finansijeContainer">
          <div className="dashboardGroup finansijeGroup">
            <div className="groupHeader">
              <div className="groupTitle">{t("dashboard.finansije")}</div>
              <span className="groupPill groupPill--operativa">{t("dashboard.finansijeOperativa")}</span>
            </div>
            <div className="groupSubtitle">{t("dashboard.finansijeSubtitle")}</div>
            <div className="finansijeRow finansijeRow--2 finansijeRow--spaced">
              <FluxaFeature id={11}>
                <ActionBtn label={t("dashboard.fakturisanje")} href="/fakture/za-fakturisanje" title={t("dashboard.fakturisanjeTitle")} />
              </FluxaFeature>
              <FluxaFeature id={12}>
                <ActionBtn label={t("dashboard.fakture")} href="/fakture" title={t("dashboard.faktureTitle")} />
              </FluxaFeature>
            </div>
            <div className="finansijeRow finansijeRow--3">
              <FluxaFeature id={13}>
                <ActionBtn label={t("dashboard.izvodi")} href="/izvodi" title={t("dashboard.izvodiTitle")} className="btn--orange-accent" />
              </FluxaFeature>
              <FluxaFeature id={14}>
                <ActionBtn label={t("dashboard.kuf")} href="/finance/kuf" title={t("dashboard.kufTitle")} />
              </FluxaFeature>
              <FluxaFeature id={15}>
                <FinanceMorePopup />
              </FluxaFeature>
            </div>
          </div>

          <div className="finansijeSidebar">
            <FluxaFeature id={16}>
              <div className="dashboardGroup">
                <div className="groupHeader">
                  <div className="groupTitle">{t("dashboard.profit")}</div>
                  <span className="groupPill groupPill--reports">{t("dashboard.profitMargin")}</span>
                </div>
                <div className="finansijeRow finansijeRow--3">
                  <FluxaFeature id={17}>
                    <ActionBtn label={t("dashboard.mjesecni")} href="/finance/profit?view=monthly" title={t("dashboard.mjesecniTitle")} />
                  </FluxaFeature>
                  <FluxaFeature id={18}>
                    <ActionBtn label={t("dashboard.godisnji")} href="/finance/profit?view=yearly" title={t("dashboard.godisnjiTitle")} />
                  </FluxaFeature>
                  <FluxaFeature id={19}>
                    <ActionBtn label={t("dashboard.marginPoKlijentu")} href="/finance/profit/klijent" title={t("dashboard.marginPoKlijentuTitle")} />
                  </FluxaFeature>
                </div>
              </div>
            </FluxaFeature>

            <FluxaFeature id={20}>
              <div className="dashboardGroup">
                <div className="groupHeader">
                  <div className="groupTitle">{t("dashboard.finansijeAnaliza")}</div>
                  <span className="groupPill groupPill--legacy">legacy</span>
                </div>
                <div className="finansijeRow finansijeRow--3">
                  <FluxaFeature id={21}>
                    <ActionBtn label={t("dashboard.finance")} href="/finance" />
                  </FluxaFeature>
                  <FluxaFeature id={22}>
                    <ActionBtn label={t("dashboard.reports")} href="/izvjestaji/svi" title={t("dashboard.izvjestajiSviTitle")} />
                  </FluxaFeature>
                  <FluxaFeature id={23}>
                    <ActionBtn label={t("dashboard.charts")} href="/izvjestaji/graficki" title={t("dashboard.izvjestajiGrafickiTitle")} />
                  </FluxaFeature>
                </div>
              </div>
            </FluxaFeature>
          </div>
        </div>
      </FluxaFeature>

      <FluxaFeature id={24}>
        <div className="dashboardGroup">
          <div className="groupHeader">
            <div className="groupTitle">{t("dashboard.sifarnici")}</div>
            <span className="groupPill">#</span>
          </div>
          <div className="groupSubtitle">{t("dashboard.sifarniciSubtitle")}</div>
          <div className="sifarniciRow sifarniciRow--3cols">
            <FluxaFeature id={25}>
              <ActionBtn label={t("dashboard.klijenti")} href="/studio/klijenti" />
            </FluxaFeature>
            <FluxaFeature id={26}>
              <ActionBtn label={t("dashboard.talenti")} href="/studio/talenti" />
            </FluxaFeature>
            <FluxaFeature id={27}>
              <ActionBtn label={t("dashboard.dobavljaci")} href="/studio/dobavljaci" />
            </FluxaFeature>
          </div>
          <div className="sifarniciRow sifarniciRow--equal sifarniciRow--blue">
            <FluxaFeature id={28}>
              <ActionBtn label={t("dashboard.cjenovnik")} href="/studio/cjenovnik" />
            </FluxaFeature>
            <FluxaFeature id={29}>
              <ActionBtn label={t("dashboard.radnici")} href="/studio/radnici" />
            </FluxaFeature>
            <FluxaFeature id={30}>
              <ActionBtn label={t("dashboard.radneFaze")} href="/studio/radne-faze" />
            </FluxaFeature>
            <FluxaFeature id={31}>
              <ActionBtn label={t("dashboard.firmaSettings")} href="/studio/firma" icon="⚙️" title={t("dashboard.firmaSettingsTitle")} />
            </FluxaFeature>
          </div>
        </div>
      </FluxaFeature>
    </>
  );
}
