import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { cookies } from "next/headers";
import LicenceClient from "./LicenceClient";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export default async function LicencePage() {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    notFound();
  }

  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
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
                  <div className="brandTitle">{t("studioLicence.title")}</div>
                  <div className="brandSub">{t("studioLicence.subtitle")}</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title={t("dashboard.title")}>
                🏠 {t("dashboard.title")}
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <LicenceClient />
        </div>
      </div>
    </div>
  );
}
