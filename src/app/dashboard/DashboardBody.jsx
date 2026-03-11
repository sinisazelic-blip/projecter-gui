"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { FluxaFeature } from "@/components/FluxaFeature";
import { PermissionGate } from "@/components/PermissionGate";
import { useAuthUser } from "@/components/AuthUserProvider";
import FinanceMorePopup from "./FinanceMorePopup";

const STORAGE_KEY = "fluxa_dashboard_sections";

function getStoredOpen() {
  if (typeof window === "undefined") return { finance: false, profitAnalysis: false, masterdata: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { finance: false, profitAnalysis: false, masterdata: false };
    const parsed = JSON.parse(raw);
    return {
      finance: !!parsed.finance,
      profitAnalysis: !!parsed.profitAnalysis,
      masterdata: !!parsed.masterdata,
    };
  } catch {
    return { finance: false, profitAnalysis: false, masterdata: false };
  }
}

function setStoredOpen(updater) {
  const next = { ...getStoredOpen(), ...(typeof updater === "function" ? updater(getStoredOpen()) : updater) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

function CollapsibleSection({ id, title, pill, open, onToggle, children, className = "", ...rest }) {
  return (
    <div className={`dashboardGroup ${className}`.trim()} {...rest}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          marginBottom: open ? "clamp(8px, 1vh, 14px)" : 0,
          textAlign: "left",
          fontSize: "inherit",
        }}
      >
        <span className="groupTitle" style={{ margin: 0, fontSize: "clamp(15px, 1.8vh, 18px)", fontWeight: 800 }}>
          {title}
        </span>
        {pill != null && pill !== "" && (
          <span className={pill === "#" ? "groupPill" : "groupPill groupPill--operativa"} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}>
            {pill}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          {open ? <ChevronUp size={20} strokeWidth={2} /> : <ChevronDown size={20} strokeWidth={2} />}
        </span>
      </button>
      {open && children}
    </div>
  );
}

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

const INITIAL_OPEN = { finance: false, profitAnalysis: false, masterdata: false };

export default function DashboardBody() {
  const { t } = useTranslation();
  const { user, canSee, loading } = useAuthUser();
  const [open, setOpen] = useState(INITIAL_OPEN);

  useEffect(() => {
    setOpen(getStoredOpen());
  }, []);

  const toggle = useCallback((id) => {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      setStoredOpen(next);
      return next;
    });
  }, []);

  if (!loading && !user) {
    return (
      <div className="dashboardGroup" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 16, color: "var(--muted)" }}>
          {t("dashboard.noAccess")}
        </p>
      </div>
    );
  }
  // Ako je korisnik prijavljen, uvijek prikaži dashboard; prava skrivaju pojedina dugmad (PermissionGate).

  return (
    <>
      <div className="dashboardGroup deskGroup" data-onboarding="desk">
        <div className="groupHeader">
          <div className="groupTitle">{t("dashboard.desk")}</div>
        </div>
        <div className="deskMainButtons">
          <PermissionGate module="Deals" inPage="-">
            <FluxaFeature id={7}>
              <Link
                href="/inicijacije"
                    className="deskMainBtn deskMainBtn--blue"
                    title={t("dashboard.dealsTitle")}
                    data-onboarding="deals"
                  >
                    <span style={{ fontSize: 28 }}>📋</span>
                    <span>{t("dashboard.deals")}</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.dealsSubtitle")}</span>
              </Link>
            </FluxaFeature>
          </PermissionGate>
          <PermissionGate module="Strategic Core" inPage="">
            <FluxaFeature id={9}>
              <Link
                href="/studio/strategic-core"
                    className="deskMainBtn deskMainBtn--sc"
                    title={t("dashboard.strategicCoreTitle")}
                  >
                    <span style={{ fontSize: 28 }}>🧮</span>
                    <span>{t("dashboard.sc")}®</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.strategicCore")}</span>
              </Link>
            </FluxaFeature>
          </PermissionGate>
          <PermissionGate module="PP" inPage="-">
            <FluxaFeature id={8}>
              <Link
                    href="/projects"
                    className="deskMainBtn deskMainBtn--green"
                    title={t("dashboard.ppTitle")}
                    data-onboarding="pp"
                  >
                    <span style={{ fontSize: 28 }}>📊</span>
                    <span>{t("dashboard.pp")}</span>
                    <span className="deskMainBtnSubtitle">{t("dashboard.ppSubtitle")}</span>
              </Link>
            </FluxaFeature>
          </PermissionGate>
        </div>
      </div>

      <FluxaFeature id={10}>
        <div className="finansijeContainer">
          <CollapsibleSection
            id="finance"
            title={t("dashboard.finansije")}
            pill={t("dashboard.finansijeOperativa")}
            open={open.finance}
            onToggle={toggle}
            className="finansijeGroup"
          >
            <div className="groupSubtitle">{t("dashboard.finansijeSubtitle")}</div>
            <div className="finansijeRow finansijeRow--2 finansijeRow--spaced">
              <PermissionGate module="Fakture" inPage="">
                <FluxaFeature id={11}>
                  <ActionBtn label={t("dashboard.fakturisanje")} href="/fakture/za-fakturisanje" title={t("dashboard.fakturisanjeTitle")} />
                </FluxaFeature>
              </PermissionGate>
              <PermissionGate module="Fakture" inPage="">
                <FluxaFeature id={12}>
                  <ActionBtn label={t("dashboard.fakture")} href="/fakture" title={t("dashboard.faktureTitle")} />
                </FluxaFeature>
              </PermissionGate>
            </div>
            <div className="finansijeRow finansijeRow--3">
              <PermissionGate module="Finansije - Banka" inPage="">
                <FluxaFeature id={13}>
                  <ActionBtn label={t("dashboard.izvodi")} href="/izvodi" title={t("dashboard.izvodiTitle")} className="btn--orange-accent" />
                </FluxaFeature>
              </PermissionGate>
              <PermissionGate module="Finansije - Dugovanja" inPage="">
                <FluxaFeature id={14}>
                  <ActionBtn label={t("dashboard.kuf")} href="/finance/kuf" title={t("dashboard.kufTitle")} />
                </FluxaFeature>
              </PermissionGate>
              <FluxaFeature id={15}>
                <FinanceMorePopup />
              </FluxaFeature>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="profitAnalysis"
            title={`${t("dashboard.profit")} / ${t("dashboard.finansijeAnaliza")}`}
            pill=""
            open={open.profitAnalysis}
            onToggle={toggle}
            data-onboarding="profit"
          >
            <div className="finansijeSidebar" style={{ marginTop: 0 }}>
              <PermissionGate module="Izvještaji" inPage="">
                <FluxaFeature id={16}>
                  <div className="dashboardGroup">
                    <div className="groupHeader">
                      <div className="groupTitle">{t("dashboard.profit")}</div>
                      <span className="groupPill groupPill--profitMargin">{t("dashboard.profitMargin")}</span>
                    </div>
                    <div className="finansijeRow finansijeRow--2">
                      <FluxaFeature id={17}>
                        <ActionBtn label={t("dashboard.profit")} href="/finance/profit" title={t("dashboard.profitTitle")} />
                      </FluxaFeature>
                      <FluxaFeature id={19}>
                        <ActionBtn label={t("dashboard.marginPoKlijentu")} href="/finance/profit/klijent" title={t("dashboard.marginPoKlijentuTitle")} />
                      </FluxaFeature>
                    </div>
                  </div>
                </FluxaFeature>
              </PermissionGate>

              <PermissionGate module="Izvještaji" inPage="">
                <FluxaFeature id={20}>
                  <div className="dashboardGroup">
                    <div className="groupHeader">
                      <div className="groupTitle">{t("dashboard.finansijeAnaliza")}</div>
                      <span className="groupPill groupPill--legacy">legacy</span>
                    </div>
                    <div className="finansijeRow finansijeRow--3">
                      <FluxaFeature id={21}>
                        <ActionBtn label={t("dashboard.financeTools")} href="/finance" />
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
              </PermissionGate>
            </div>
          </CollapsibleSection>
        </div>
      </FluxaFeature>

      <FluxaFeature id={24}>
        <CollapsibleSection
          id="masterdata"
          title={t("dashboard.sifarnici")}
          pill="#"
          open={open.masterdata}
          onToggle={toggle}
        >
          <div className="groupSubtitle">{t("dashboard.sifarniciSubtitle")}</div>
          <div className="sifarniciRow sifarniciRow--3cols">
            <PermissionGate module="Šifarnici - Klijenti" inPage="">
              <FluxaFeature id={25}>
                <ActionBtn label={t("dashboard.klijenti")} href="/studio/klijenti" />
              </FluxaFeature>
            </PermissionGate>
            <PermissionGate module="Šifarnici - Talenti" inPage="">
              <FluxaFeature id={26}>
                <ActionBtn label={t("dashboard.talenti")} href="/studio/talenti" />
              </FluxaFeature>
            </PermissionGate>
            <PermissionGate module="Šifarnici - Dobavljači" inPage="">
              <FluxaFeature id={27}>
                <ActionBtn label={t("dashboard.dobavljaci")} href="/studio/dobavljaci" />
              </FluxaFeature>
            </PermissionGate>
          </div>
          <div className="sifarniciRow sifarniciRow--equal sifarniciRow--blue">
            <PermissionGate module="Šifarnici - Cjenovnik" inPage="">
              <FluxaFeature id={28}>
                <ActionBtn label={t("dashboard.cjenovnik")} href="/studio/cjenovnik" />
              </FluxaFeature>
            </PermissionGate>
            <PermissionGate module="Šifarnici - Radnici" inPage="">
              <FluxaFeature id={29}>
                <ActionBtn label={t("dashboard.radnici")} href="/studio/radnici" />
              </FluxaFeature>
            </PermissionGate>
            <PermissionGate module="Šifarnici - Faze" inPage="">
              <FluxaFeature id={30}>
                <ActionBtn label={t("dashboard.radneFaze")} href="/studio/radne-faze" />
              </FluxaFeature>
            </PermissionGate>
            <PermissionGate module="Firma (postavke, logo)" inPage="">
              <FluxaFeature id={31}>
                <ActionBtn label={t("dashboard.firmaSettings")} href="/studio/firma" icon="⚙️" title={t("dashboard.firmaSettingsTitle")} />
              </FluxaFeature>
            </PermissionGate>
          </div>
        </CollapsibleSection>
      </FluxaFeature>
    </>
  );
}
