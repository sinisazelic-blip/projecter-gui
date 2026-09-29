"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";
import { useAuthUser } from "@/components/AuthUserProvider";

export default function DashboardMobileButton({ instance = "STUDIO" }) {
  const { t } = useTranslation();
  const { isFeatureVisible } = useFluxaEdition();
  const { canSee } = useAuthUser();
  const enter = instance === "ENTER";
  const showMobile = !enter && isFeatureVisible(5) && canSee("Mobile dashboard", "-");

  if (!showMobile) return null;

  return (
    <Link
      href="/mobile"
      className="btn"
      title={t("nav.mobileTitle")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 10,
        fontWeight: 700,
        fontSize: 13,
        padding: "6px 14px",
        background: "rgba(168, 85, 247, 0.12)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        color: "#d8b4fe",
      }}
    >
      📱 {t("nav.mobile")}
    </Link>
  );
}
