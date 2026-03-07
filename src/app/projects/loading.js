import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";

export default async function Loading() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) || "sr";
  const t = getT(locale);
  return (
    <div className="container">
      <h1 style={{ fontSize: 22, marginBottom: 14 }}>{t("dashboard.projects")}</h1>
      <div className="card">{t("common.loading")}</div>
    </div>
  );
}
