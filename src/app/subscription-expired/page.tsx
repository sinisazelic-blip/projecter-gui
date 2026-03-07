import Link from "next/link";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { cookies } from "next/headers";
import SubscriptionExpiredActions from "./SubscriptionExpiredActions";

export const dynamic = "force-dynamic";

export default async function SubscriptionExpiredPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  return (
    <div className="container" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>{t("subscriptionExpired.title")}</h1>
        <p style={{ marginBottom: 24, opacity: 0.9 }}>{t("subscriptionExpired.message")}</p>
        <p style={{ marginBottom: 24, fontSize: 14, opacity: 0.8 }}>{t("subscriptionExpired.contact")}</p>
        <SubscriptionExpiredActions />
      </div>
    </div>
  );
}
