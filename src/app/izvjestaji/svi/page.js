import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import SviIzvjestajiClient from "./SviIzvjestajiClient";

export const dynamic = "force-dynamic";

export default async function SviIzvjestajiPage() {
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
                  <img
                    src="/fluxa/logo-light.png"
                    alt="FLUXA"
                    className="brandLogo"
                  />
                  <span className="brandSlogan">Project & Finance Engine</span>
                </div>
                <div>
                  <div className="brandTitle">{t("izvjestajiSvi.title")}</div>
                  <div className="brandSub">{t("izvjestajiSvi.subtitle")}</div>
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
          <SviIzvjestajiClient />
        </div>
      </div>
    </div>
  );
}
