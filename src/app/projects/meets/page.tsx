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
  const projects: any = await query(
    `
    SELECT
      p.projekat_id,
      p.radni_naziv AS naziv_projekta,
      p.status_id,
      sp.naziv_statusa AS status_name,
      p.narucilac_id,
      k.naziv_klijenta,
      COALESCE(p.rok_glavni, p.created_at) AS datum_pocetka,
      p.event_kraj AS datum_zavrsetka,
      COALESCE(stavke_sum.ukupno_stavke_km, p.budzet_planirani, 0) AS budzet_km,
      p.napomena,
      COALESCE(troskovi_sum.ukupno_troskovi_km, 0) AS ukupno_troskovi_km,
      f.faktura_id,
      COALESCE(f.broj_fakture_puni, CONCAT(f.godina, '-', f.broj_u_godini)) AS broj_fakture,
      COALESCE(bl_in.kes_uplata_km, 0) AS kes_uplata_km,
      CASE
        WHEN COALESCE(bl_in.kes_uplata_km, 0) > 0 THEN 'UPLATA_KES'
        WHEN f.fiskalni_status = 'PLACENA' THEN 'PLACENA'
        WHEN f.fiskalni_status = 'STORNIRAN' THEN 'STORNIRAN'
        WHEN f.faktura_id IS NOT NULL THEN 'IZDATA'
        ELSE 'NEMA_FAKTURE'
      END AS faktura_status_naplate
    FROM projekti p
    LEFT JOIN statusi_projekta sp ON sp.status_id = p.status_id
    LEFT JOIN klijenti k ON k.klijent_id = p.narucilac_id
    LEFT JOIN (
      SELECT projekat_id, SUM(line_total) AS ukupno_stavke_km
      FROM projekat_stavke
      WHERE snapshot_id IS NULL
      GROUP BY projekat_id
    ) stavke_sum ON stavke_sum.projekat_id = p.projekat_id
    LEFT JOIN (
      SELECT projekat_id, SUM(iznos_km) AS ukupno_troskovi_km
      FROM projektni_troskovi
      WHERE status <> 'STORNIRANO'
      GROUP BY projekat_id
    ) troskovi_sum ON troskovi_sum.projekat_id = p.projekat_id
    LEFT JOIN (
      SELECT fp.projekat_id, MAX(fak.faktura_id) AS faktura_id
      FROM faktura_projekti fp
      JOIN fakture fak ON fak.faktura_id = fp.faktura_id
      WHERE (fak.fiskalni_status IS NULL OR fak.fiskalni_status <> 'STORNIRAN')
      GROUP BY fp.projekat_id
    ) fp_link ON fp_link.projekat_id = p.projekat_id
    LEFT JOIN fakture f ON f.faktura_id = fp_link.faktura_id
    LEFT JOIN (
      SELECT project_id, SUM(iznos) AS kes_uplata_km
      FROM blagajna_stavke
      WHERE smjer = 'IN' AND status = 'AKTIVAN' AND project_id IS NOT NULL
      GROUP BY project_id
    ) bl_in ON bl_in.project_id = p.projekat_id
    WHERE (
      p.projekat_id IN (SELECT DISTINCT projekat_id FROM projekat_stavke WHERE LOWER(naziv) LIKE '%swim%' OR LOWER(naziv) LIKE '%mjer%')
      OR LOWER(p.radni_naziv) LIKE '%-swmm%'
      OR LOWER(p.radni_naziv) LIKE '%swmm%'
      OR LOWER(p.radni_naziv) LIKE '%swim%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%pliva%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%leotar%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%olymp%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%aquastar%'
      OR LOWER(COALESCE(k.naziv_klijenta, '')) LIKE '%22. april%'
    )
    ORDER BY COALESCE(p.rok_glavni, p.created_at) DESC
    LIMIT 200
    `,
  ).catch((err) => {
    console.error("Greška pri učitavanju plivačkih projekata:", err);
    return [];
  });

  // Učitaj samo naručioce koji plaćaju (plivački klubovi, savezi, partneri)
  const klijenti = await query(
    `SELECT klijent_id, naziv_klijenta FROM klijenti WHERE aktivan = 1 AND (is_narucilac = 1 OR is_narucilac IS NULL) ORDER BY naziv_klijenta ASC LIMIT 500`,
  ).catch(() => []);

  // Učitaj defaultnu tarifu iz šifarnika cjenovnika (usluge mjerenja plivačkih takmičenja)
  const cjenovnikStavka: any = await query(
    `SELECT cijena_default FROM cjenovnik_stavke WHERE (LOWER(naziv) LIKE '%pliva%' OR LOWER(naziv) LIKE '%mjer%') AND active = 1 ORDER BY stavka_id ASC LIMIT 1`,
  ).catch(() => []);
  const defaultDnevnaTarifa = Number(cjenovnikStavka?.[0]?.cijena_default) || 500;

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
          <MeetsClient
            initialProjects={projects ?? []}
            klijenti={klijenti ?? []}
            defaultDnevnaTarifa={defaultDnevnaTarifa}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
