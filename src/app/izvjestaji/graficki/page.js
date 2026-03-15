import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";
import GrafickiClient from "./GrafickiClient";

export const dynamic = "force-dynamic";

export default async function GrafickiPage() {
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
                  <div className="brandTitle">{t("izvjestajiGraficki.title")}</div>
                  <div className="brandSub">{t("izvjestajiGraficki.subtitle")}</div>
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
          <GrafickiClient />
        </div>
      </div>
    </div>
  );
}
