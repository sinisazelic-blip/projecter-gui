import RadneFazeClient from "./RadneFazeClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type RadnaFazaRow = {
  faza_id: number;
  naziv: string;
  opis_poslova: string | null;
  slozenost_posla: string | null;
  vrsta_posla: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default async function RadneFazePage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const rows = await query(
    `SELECT faza_id, naziv, opis_poslova, slozenost_posla, vrsta_posla,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM radne_faze
       ORDER BY naziv ASC
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
                  <div className="brandTitle">{t("studioRadneFaze.title")}</div>
                  <div className="brandSub">{t("studioRadneFaze.subtitle")}</div>
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
          <RadneFazeClient initialItems={(rows ?? []) as RadnaFazaRow[]} />
        </div>
      </div>
    </div>
  );
}
