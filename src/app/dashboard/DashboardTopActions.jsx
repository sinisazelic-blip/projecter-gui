"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";
import { useAuthUser } from "@/components/AuthUserProvider";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";

export default function DashboardTopActions({ instance = "STUDIO" }) {
  const { t } = useTranslation();
  const { isFeatureVisible } = useFluxaEdition();
  const { user, nivo, canSee, onboardingCompleted, completeOnboarding } = useAuthUser();
  const enter = instance === "ENTER";
  const showBlagajna = isFeatureVisible(6) && canSee("Blagajna", "");
  const isOwnerOrAdmin = user?.user_id === 0 || user?.username === "Owner" || (nivo ?? 0) >= 8 || canSee("Šifarnici - Users", "");

  return (
    <div className="actions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {isOwnerOrAdmin && <WorkspaceSwitcher />}
      {!onboardingCompleted && (
        <button type="button" className="btn" onClick={completeOnboarding} style={{ fontSize: 13 }}>
          Skip tour
        </button>
      )}

      {showBlagajna && (
        <Link href="/cash" className="btn" title={t("nav.cashTitle")}>
          💰 {t("nav.cash")}
        </Link>
      )}

      {enter && (
        <Link href="/ops/tenanti" className="btn" title={t("dashboard.enterTenantiTitle")}>
          {t("dashboard.enterTenanti")}
        </Link>
      )}

      <button
        type="button"
        className="btn"
        title={t("common.logout")}
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/";
        }}
      >
        {t("common.logout")}
      </button>
    </div>
  );
}

