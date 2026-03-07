// src/app/projects/[id]/_components/ProjectSummaryCard.js
"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { getCurrencyForLocale } from "@/lib/i18n";

const EUR_TO_BAM = 1.95583;

function formatAmount(amountKm, locale, t) {
  const n = Number(amountKm);
  if (!Number.isFinite(n)) return "—";
  const ccy = getCurrencyForLocale(locale);
  const suffix = ccy === "EUR" ? ` ${t("projectDetail.currencyEur")}` : ` ${t("projectDetail.currencyKm")}`;
  const val = ccy === "EUR" ? n / EUR_TO_BAM : n;
  const fixed = val.toFixed(2);
  const formatted = locale === "en" ? fixed : fixed.replace(".", ",");
  return formatted + suffix;
}

export default function ProjectSummaryCard({ project, locale: localeProp }) {
  const { t, locale: ctxLocale } = useTranslation();
  const locale = localeProp ?? ctxLocale ?? "sr";

  if (!project) return null;

  const punBudzet = Number(project.budzet_planirani) || 0;
  const procenatZaTim = Number(project.budzet_procenat_za_tim) || 100.00;
  const budzetZaTim = punBudzet * (procenatZaTim / 100);
  const planiranaZaradaZaTim = budzetZaTim - (Number(project.troskovi_ukupno) || 0);

  const currencyLabel = getCurrencyForLocale(locale) === "EUR"
    ? t("projectDetail.currencyEur")
    : t("projectDetail.currencyKm");

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">
            {t("projectDetail.budgetLabel")} ({currencyLabel})
            {procenatZaTim !== 100 && (
              <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>
                ({procenatZaTim.toFixed(0)}%)
              </span>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatAmount(budzetZaTim, locale, t)}
          </div>
          {procenatZaTim !== 100 && punBudzet > 0 && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.6,
                marginTop: 2,
                fontStyle: "italic",
              }}
              title={`${t("projectDetail.budgetFull")} ${formatAmount(punBudzet, locale, t)}`}
            >
              ({t("projectDetail.budgetFullShort")} {formatAmount(punBudzet, locale, t)})
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">{t("projectDetail.costsTotal")}</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatAmount(project.troskovi_ukupno, locale, t)}
          </div>
        </div>

        <div style={{ flex: "1 1 240px" }}>
          <div className="muted">{t("projectDetail.plannedProfit")}</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: planiranaZaradaZaTim < 0 ? "rgba(255, 80, 80, 0.95)" : "inherit",
            }}
          >
            {formatAmount(planiranaZaradaZaTim, locale, t)}
          </div>
        </div>
      </div>
    </div>
  );
}
