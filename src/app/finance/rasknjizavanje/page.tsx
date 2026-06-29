import Link from "next/link";
import { cookies } from "next/headers";
import FluxaLogo from "@/components/FluxaLogo";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import RasknjizavanjeClient from "./RasknjizavanjeClient";

export const dynamic = "force-dynamic";

export default async function RasknjizavanjePage({
  searchParams,
}: {
  searchParams: Promise<{ batch_id?: string }>;
}) {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);
  const sp = await searchParams;
  const batchId = Number(sp?.batch_id || 0);
  const batchFilter = Number.isFinite(batchId) && batchId > 0 ? batchId : null;

  return (
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
                  <div className="brandTitle">{t("rasknjizavanje.title")}</div>
                  <div className="brandSub">{t("rasknjizavanje.subtitle")}</div>
                </div>
              </div>
              <div className="actions">
                <Link href="/banking/import" className="btn">
                  {t("rasknjizavanje.goImport")}
                </Link>
                <Link href="/studio/finance-tools" className="btn">
                  {t("dashboard.financeTools")}
                </Link>
                <Link href="/finance/banka" className="btn">
                  {t("banka.title")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("common.dashboard")}>
                  <img
                    src="/fluxa/Icon.ico"
                    alt=""
                    style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }}
                  />{" "}
                  {t("common.dashboard")}
                </Link>
              </div>
            </div>
            <div className="divider" />
          </div>
        </div>
        <div className="bodyWrap">
          <RasknjizavanjeClient batchId={batchFilter} />
        </div>
      </div>
    </div>
  );
}
