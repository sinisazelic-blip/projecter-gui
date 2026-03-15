import DobavljaciClient from "./DobavljaciClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type DobavljacRow = {
  dobavljac_id: number;
  naziv: string;
  vrsta:
    | "studio"
    | "freelancer"
    | "servis"
    | "ostalo"
    | "rental"
    | "video_produkcija"
    | "organizacija_dogadaja"
    | "restoran"
    | "transport"
    | "rasvjeta"
    | "bina"
    | "led_video"
    | "bilbordi"
    | "novine"
    | "web_portali"
    | "socijalne_mreze"
    | "developing"
    | "web_developing"
    | "tv"
    | "radio"
    | "oglasivaci"
    | "agencije";
  pravno_lice: number; // 1/0
  drzava_iso2: string | null;
  grad: string | null;
  postanski_broj: string | null;
  email: string | null;
  telefon: string | null;
  adresa: string | null;
  napomena: string | null;
  aktivan: number; // 1/0
  created_at: string | null;
  updated_at: string | null;
};

export default async function DobavljaciPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const rows = await query(
    `SELECT dobavljac_id, naziv, vrsta, pravno_lice, drzava_iso2, grad, postanski_broj,
            email, telefon, adresa, napomena, aktivan,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM dobavljaci
       ORDER BY aktivan DESC, naziv ASC
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
                  <div className="brandTitle">{t("studioDobavljaci.title")}</div>
                  <div className="brandSub">{t("studioDobavljaci.subtitle")}</div>
                </div>
              </div>

              <Link href="/dashboard" className="btn" title={t("dashboard.title")}>
                <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> {t("dashboard.title")}
              </Link>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <DobavljaciClient initialItems={(rows ?? []) as DobavljacRow[]} />
        </div>
      </div>
    </div>
  );
}
