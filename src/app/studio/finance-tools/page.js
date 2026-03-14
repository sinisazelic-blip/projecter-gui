import Link from "next/link";
import { cookies } from "next/headers";
import FluxaLogo from "@/components/FluxaLogo";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FinanceToolsClient from "./FinanceToolsClient";
import FinanceToolsEditionGate from "./FinanceToolsEditionGate";

export const dynamic = "force-dynamic";

export default async function FinanceToolsPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  return (
    <FinanceToolsEditionGate>
      <div className="container">
        <div className="pageWrap">
          <div className="topBlock">
            <div className="topInner">
              <div className="topRow">
                <div className="brandWrap">
                  <div className="brandLogoBlock">
                    <FluxaLogo />
                    <span className="brandSlogan">Project & Finance Engine</span>
                  </div>
                  <div>
                    <div className="brandTitle">{t("dashboard.financeTools")}</div>
                    <div className="brandSub">{t("financeTools.brandSub")}</div>
                  </div>
                </div>

                <Link href="/finance" className="btn" title={t("finance.title")}>
                  ← {t("finance.title")}
                </Link>
              </div>

              <div className="divider" />
            </div>
          </div>

          <div className="bodyWrap">
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">⚠️ {t("financeTools.operativniAlati")}</div>
              <div className="card-subtitle">{t("financeTools.toolsWarning")}</div>
            </div>

            <FinanceToolsClient />
          </div>
        </div>
      </div>
    </FinanceToolsEditionGate>
  );
}
