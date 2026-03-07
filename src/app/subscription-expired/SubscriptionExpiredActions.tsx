"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

export default function SubscriptionExpiredActions() {
  const { t } = useTranslation();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
      <Link href="/studio/licence" className="btn">
        {t("subscriptionExpired.goToLicence")}
      </Link>
      <button type="button" className="btn" onClick={handleLogout}>
        {t("common.logout")}
      </button>
    </div>
  );
}
