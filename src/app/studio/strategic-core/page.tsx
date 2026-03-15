"use client";

import Link from "next/link";
import StrategicCoreClient from "./StrategicCoreClient";
import { useTranslation } from "@/components/LocaleProvider";
import FluxaLogo from "@/components/FluxaLogo";

export default function StrategicCorePage() {
  const { t } = useTranslation();
  return (
    <div className="container" style={{ minHeight: "100vh" }}>
      <div className="pageWrap">
        <div className="topBlock">
          <div className="topInner">
            <div className="topRow">
              <div className="brandWrap">
                <div className="brandLogoBlock">
                  <FluxaLogo /><span className="brandSlogan">{t("scPage.brandSlogan")}</span>
                </div>
                <div>
                  <div className="brandTitle">{t("scPage.pageTitle")}</div>
                  <div className="brandSub">{t("scPage.pageSubtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href="/dashboard" className="btn" title={t("scPage.dashboard")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("scPage.dashboard")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <StrategicCoreClient />
        </div>
      </div>
    </div>
  );
}
