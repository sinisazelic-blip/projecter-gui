import RolesClient from "./RolesClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type RoleRow = {
  role_id: number;
  naziv: string;
  nivo_ovlastenja: number;
  opis: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default async function RolesPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'roles'
        AND COLUMN_NAME IN ('nivo_ovlastenja', 'nivo_ovlascenja', 'created_at', 'updated_at')`,
  )) as any[];

  const nivoCol = (cols ?? []).find(
    (r) =>
      String(r.COLUMN_NAME).toLowerCase() === "nivo_ovlastenja" ||
      String(r.COLUMN_NAME).toLowerCase() === "nivo_ovlascenja",
  );
  const nivoColName = nivoCol ? String(nivoCol.COLUMN_NAME) : null;
  const hasNivoOvlastenja = !!nivoColName;
  const hasCreatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "created_at",
  );
  const hasUpdatedAt = (cols ?? []).some(
    (r) => String(r.COLUMN_NAME).toLowerCase() === "updated_at",
  );

  const selectCols = [
    "role_id",
    "naziv",
    hasNivoOvlastenja ? `${nivoColName} AS nivo_ovlastenja` : "0 AS nivo_ovlastenja",
    "opis",
    hasCreatedAt ? "DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at" : "NULL AS created_at",
    hasUpdatedAt ? "DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at" : "NULL AS updated_at",
  ].join(", ");
  const orderBy = hasNivoOvlastenja && nivoColName
    ? `${nivoColName} DESC, naziv ASC`
    : "naziv ASC";

  const rows = await query(
    `SELECT ${selectCols}
       FROM roles
       ORDER BY ${orderBy}
       LIMIT 1000`,
  );

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
                  <div className="brandTitle">{t("studioRoles.title")}</div>
                  <div className="brandSub">{t("studioRoles.subtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link href="/studio/firma" className="btn" title={t("studioRoles.backToFirmaSettings")}>
                  ← {t("studioRoles.backToFirmaSettings")}
                </Link>
                <Link href="/dashboard" className="btn" title={t("dashboard.title")}>
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("dashboard.title")}
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <RolesClient initialItems={(rows ?? []) as RoleRow[]} />
        </div>
      </div>
    </div>
  );
}
