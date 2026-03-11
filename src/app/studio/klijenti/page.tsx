import KlijentiClient from "./KlijentiClient";
import { query } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import FluxaLogo from "@/components/FluxaLogo";

export const dynamic = "force-dynamic";

export type KlijentRow = {
  klijent_id: number;
  naziv_klijenta: string;
  tip_klijenta: "direktni" | "agencija";
  porezni_id: string | null;
  jib?: string | null; // JIB 13 cifara – za fiskalni uređaj
  pib?: string | null; // PIB 12 cifara – ne šalje se na PU
  adresa: string | null;
  grad: string | null;
  drzava: string | null;
  email: string | null;
  rok_placanja_dana: number;
  napomena: string | null;
  aktivan: number; // 1/0
  is_ino: number; // 1/0
  pdv_oslobodjen?: number; // 1/0 — oslobođen po članu 24
  pdv_oslobodjen_napomena?: string | null; // napomena za fakturu
  created_at: string | null;
  updated_at: string | null;
};

export default async function KlijentiPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  const cols: any[] = (await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'klijenti'
        AND LOWER(COLUMN_NAME) IN ('created_at', 'updated_at', 'pdv_oslobodjen', 'email', 'jib', 'pib')`,
  )) as any[];

  const colSet = new Set((cols ?? []).map((r) => String(r.COLUMN_NAME).toLowerCase()));
  const hasPdvOslobodjen = colSet.has("pdv_oslobodjen");
  const hasEmail = colSet.has("email");
  // EU regional (i18n en): Firma i Klijenti nemaju JIB/PIB, samo VAT No (porezni_id). BiH ima JIB (13) i PIB (12).
  const isEuRegion = locale === "en";
  const hasJib = !isEuRegion && colSet.has("jib");
  const hasPib = !isEuRegion && colSet.has("pib");

  const pdvCols = hasPdvOslobodjen
    ? `, COALESCE(pdv_oslobodjen, 0) AS pdv_oslobodjen, pdv_oslobodjen_napomena`
    : ", 0 AS pdv_oslobodjen, NULL AS pdv_oslobodjen_napomena";
  const emailCol = hasEmail ? ", email" : ", NULL AS email";
  const jibPibCols = [hasJib && "jib", hasPib && "pib"].filter(Boolean).join(", ");
  const jibPibSelect = jibPibCols ? `, ${jibPibCols}` : ", NULL AS jib, NULL AS pib";

  const rows = await query(
    `SELECT klijent_id, naziv_klijenta, tip_klijenta, porezni_id${jibPibSelect}, adresa, grad, drzava${emailCol},
            rok_placanja_dana, napomena, aktivan, is_ino${pdvCols},
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM klijenti
       ORDER BY aktivan DESC, naziv_klijenta ASC
       LIMIT 1500`,
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
                  <div className="brandTitle">{t("studioKlijenti.title")}</div>
                  <div className="brandSub">{t("studioKlijenti.subtitle")}</div>
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
          <KlijentiClient initialItems={(rows ?? []) as KlijentRow[]} hasJib={hasJib} hasPib={hasPib} />
        </div>
      </div>
    </div>
  );
}
