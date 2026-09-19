import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import FluxaLogo from "@/components/FluxaLogo";
import MeetsClient from "./MeetsClient";

export const dynamic = "force-dynamic";

export default async function SwimMeetsPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  // Učitaj projekte koji su plivačka takmičenja ili povezani sa savezima/klubovima
  const projects = await query(
    `
    SELECT
      p.projekat_id,
      p.naziv_projekta,
      p.status_id,
      sp.status_name,
      p.narucilac_id,
      k.naziv_klijenta,
      p.datum_pocetka,
      p.datum_zavrsetka,
      p.budzet_km,
      p.napomena,
      COALESCE(SUM(pt.iznos_km), 0) AS ukupno_troskovi_km,
      f.faktura_id,
      f.broj_fakture,
      f.status_naplate AS faktura_status_naplate
    FROM projekti p
    LEFT JOIN statusi_projekta sp ON sp.status_id = p.status_id
    LEFT JOIN klijenti k ON k.klijent_id = p.narucilac_id
    LEFT JOIN projektni_troskovi pt ON pt.projekat_id = p.projekat_id AND pt.status <> 'STORNIRANO'
    LEFT JOIN (
      SELECT fp.projekat_id, MAX(fak.faktura_id) AS faktura_id
      FROM faktura_projekti fp
      JOIN fakture fak ON fak.faktura_id = fp.faktura_id
      WHERE (fak.fiskalni_status IS NULL OR fak.fiskalni_status <> 'STORNIRAN')
      GROUP BY fp.projekat_id
    ) fp_link ON fp_link.projekat_id = p.projekat_id
    LEFT JOIN fakture f ON f.faktura_id = fp_link.faktura_id
    WHERE (
      LOWER(p.naziv_projekta) LIKE '%kup%'
      OR LOWER(p.naziv_projekta) LIKE '%prvenstvo%'
      OR LOWER(p.naziv_projekta) LIKE '%takmičenje%'
      OR LOWER(p.naziv_projekta) LIKE '%takmicenje%'
      OR LOWER(p.naziv_projekta) LIKE '%miting%'
      OR LOWER(p.naziv_projekta) LIKE '%swim%'
      OR LOWER(p.naziv_projekta) LIKE '%pliva%'
      OR LOWER(p.naziv_projekta) LIKE '%memorijal%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%pliv%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%savez%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%klub%'
    )
    GROUP BY p.projekat_id, p.naziv_projekta, p.status_id, sp.status_name, p.narucilac_id, k.naziv_klijenta, p.datum_pocetka, p.datum_zavrsetka, p.budzet_km, p.napomena, f.faktura_id, f.broj_fakture, f.status_naplate
    ORDER BY COALESCE(p.datum_pocetka, p.created_at) DESC
    LIMIT 200
    `,
  ).catch(() => []);

  // Učitaj naručioce (plivački klubovi, savezi itd.)
  const klijenti = await query(
    `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE aktivan = 1 ORDER BY naziv_klijenta ASC LIMIT 500`,
  ).catch(() => []);

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
                  <div className="brandTitle">🏊 Plivačka takmičenja & Mjerenje vremena</div>
                  <div className="brandSub">
                    Upravljanje takmičarskim projektima, startnim listama, obradom rezultata i dnevnicama
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/projects" className="btn" title="Svi projekti">
                  📊 Svi poslovi
                </Link>
                <Link href="/dashboard" className="btn" title="Dashboard">
                  <img src="/fluxa/Icon.ico" alt="" style={{ width: 18, height: 18, verticalAlign: "middle", marginRight: 6 }} /> Dashboard
                </Link>
              </div>
            </div>

            <div className="divider" />
          </div>
        </div>

        <div className="bodyWrap">
          <MeetsClient initialProjects={projects ?? []} klijenti={klijenti ?? []} locale={locale} />
        </div>
      </div>
    </div>
  );
}
