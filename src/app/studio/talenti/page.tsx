import TalentiClient from "./TalentiClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type TalentRow = {
  talent_id: number;
  ime_prezime: string;
  vrsta:
    | "spiker"
    | "glumac"
    | "pjevac"
    | "dijete"
    | "muzicar"
    | "ostalo"
    | "snimatelj"
    | "kompozitor"
    | "copywriter"
    | "producent"
    | "montazer"
    | "reziser"
    | "organizator"
    | "account"
    | "developer";
  email: string | null;
  telefon: string | null;
  napomena: string | null;
  aktivan: number; // 1/0
  created_at: string | null;
  updated_at: string | null;
};

export default async function TalentiPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const rows = await query(
    `SELECT talent_id, ime_prezime, vrsta, email, telefon, napomena, aktivan,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM talenti
       ORDER BY aktivan DESC, ime_prezime ASC
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
                  <div className="brandTitle">{t("studioTalenti.title")}</div>
                  <div className="brandSub">{t("studioTalenti.subtitle")}</div>
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
          <TalentiClient initialItems={(rows ?? []) as TalentRow[]} />
        </div>
      </div>
    </div>
  );
}
