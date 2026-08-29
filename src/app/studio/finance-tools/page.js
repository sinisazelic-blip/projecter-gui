import Link from "next/link";
import { cookies } from "next/headers";
import FluxaLogo from "@/components/FluxaLogo";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FinanceToolsClient from "./FinanceToolsClient";
import FinanceToolsEditionGate from "./FinanceToolsEditionGate";
import { isEnterInstance } from "@/lib/fluxa-instance";

export const dynamic = "force-dynamic";

export default async function FinanceToolsPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);

  const enter = isEnterInstance();

  return (
    <FinanceToolsEditionGate allowEnter={enter}>
      <div className="container">
        <div className="pageWrap">
          <div className="topBlock">
            <div className="topInner">
              <div className="topRow">
                <div className="brandWrap">
                  <div className="brandLogoBlock">
                    <FluxaLogo />
                    <span className="brandSlogan">
                      {enter ? "Deal, Ops & Finance" : "Project & Finance Engine"}
                    </span>
                  </div>
                  <div>
                    <div className="brandTitle">{t("dashboard.financeTools")}</div>
                    <div className="brandSub" title={t("financeTools.brandSub")}>Radni panel</div>
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
            <FinanceToolsClient />
          </div>
        </div>
      </div>
    </FinanceToolsEditionGate>
  );
}
