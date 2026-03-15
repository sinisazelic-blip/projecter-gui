import UsersClient from "./UsersClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type UserRow = {
  user_id: number;
  username: string;
  role_id: number;
  role_naziv: string | null;
  aktivan: number; // 1/0
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  radnik_id: number | null;
  radnik_ime_prezime: string | null;
};

export type RoleOption = {
  role_id: number;
  naziv: string;
};

export type RadnikOption = {
  radnik_id: number;
  ime: string;
  prezime: string;
};

export default async function UsersPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const [rows, roles, radnici] = await Promise.all([
    query<UserRow>(`
      SELECT
        u.user_id,
        u.username,
        u.role_id,
        r.naziv AS role_naziv,
        u.aktivan,
        u.last_login_at,
        DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
        u.radnik_id,
        CONCAT(rad.ime, ' ', rad.prezime) AS radnik_ime_prezime
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN radnici rad ON rad.radnik_id = u.radnik_id
      ORDER BY u.aktivan DESC, u.username ASC
      LIMIT 2000
    `),
    query<RoleOption>(`SELECT role_id, naziv FROM roles ORDER BY naziv ASC LIMIT 500`),
    query<RadnikOption>(`SELECT radnik_id, ime, prezime FROM radnici WHERE aktivan = 1 ORDER BY prezime ASC, ime ASC LIMIT 1000`),
  ]);

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
                  <div className="brandTitle">{t("studioUsers.title")}</div>
                  <div className="brandSub">{t("studioUsers.subtitle")}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link href="/studio/firma" className="btn" title={t("studioUsers.backToFirmaSettings")}>
                  ← {t("studioUsers.backToFirmaSettings")}
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
          <UsersClient
            initialItems={(rows ?? []) as UserRow[]}
            roles={(roles ?? []) as RoleOption[]}
            radnici={(radnici ?? []) as RadnikOption[]}
          />
        </div>
      </div>
    </div>
  );
}
