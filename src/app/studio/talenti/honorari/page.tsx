import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import FluxaLogo from "@/components/FluxaLogo";
import { formatAmount } from "@/lib/format";
import HonorariClient from "./HonorariClient";

export const dynamic = "force-dynamic";

export default async function TalentHonorariPage() {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  // Učitaj sve troškove talenata sa statusom povezanog projekta, fakture i isplate
  const rows = await query(
    `
    SELECT
      t.trosak_id,
      t.projekat_id,
      p.naziv_projekta,
      k.naziv_klijenta,
      tal.talent_id,
      tal.ime_prezime AS talent_naziv,
      tal.vrsta AS talent_vrsta,
      t.iznos_km AS honorar_iznos_km,
      t.opis AS honorar_opis,
      COALESCE(t.datum_troska, t.created_at) AS datum_angazmana,
      t.status AS trosak_status,
      f.faktura_id,
      f.broj_fakture,
      f.datum_izdavanja AS faktura_datum,
      f.iznos_ukupno_km AS faktura_iznos_km,
      COALESCE(
        CASE 
          WHEN f.fiskalni_status = 'STORNIRAN' THEN 'STORNIRANO'
          WHEN f.datum_placanja IS NOT NULL OR f.status_naplate = 'PLACENO' THEN 'PLACENO'
          ELSE 'NEPLACENO'
        END,
        'NEMA_FAKTURE'
      ) AS faktura_status_naplate,
      COALESCE(ps_sum.isplaceno_km, 0) + COALESCE(bl_sum.isplaceno_km, 0) AS vec_isplaceno_km
    FROM projektni_troskovi t
    JOIN talenti tal ON (t.entity_type = 'talent' AND t.entity_id = tal.talent_id) OR (t.talent_id = tal.talent_id)
    LEFT JOIN projekti p ON p.projekat_id = t.projekat_id
    LEFT JOIN klijenti k ON k.klijent_id = p.narucilac_id
    LEFT JOIN (
      SELECT fp.projekat_id, MAX(fak.faktura_id) AS faktura_id
      FROM faktura_projekti fp
      JOIN fakture fak ON fak.faktura_id = fp.faktura_id
      WHERE (fak.fiskalni_status IS NULL OR fak.fiskalni_status <> 'STORNIRAN')
      GROUP BY fp.projekat_id
    ) fp_link ON fp_link.projekat_id = t.projekat_id
    LEFT JOIN fakture f ON f.faktura_id = fp_link.faktura_id
    LEFT JOIN (
      SELECT trosak_id, SUM(iznos_km) AS isplaceno_km
      FROM placanja_stavke
      GROUP BY trosak_id
    ) ps_sum ON ps_sum.trosak_id = t.trosak_id
    LEFT JOIN (
      SELECT project_id, entity_id, SUM(iznos) AS isplaceno_km
      FROM blagajna_stavke
      WHERE entity_type = 'talent' AND smjer = 'OUT' AND status = 'AKTIVAN'
      GROUP BY project_id, entity_id
    ) bl_sum ON bl_sum.project_id = t.projekat_id AND bl_sum.entity_id = tal.talent_id
    WHERE COALESCE(t.status, '') <> 'STORNIRANO'
    ORDER BY datum_angazmana DESC, t.trosak_id DESC
    LIMIT 500
    `,
  ).catch((err) => {
    console.error("Greška pri učitavanju honorara:", err);
    return [];
  });

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
                  <div className="brandTitle">🎙️ Honorari saradnika i talenata</div>
                  <div className="brandSub">
                    Pregled angažmana spikera, muzičara i saradnika uz direktnu vezu sa naplatom faktura
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href="/studio/talenti" className="btn" title="Šifarnik talenata">
                  👥 Šifarnik saradnika
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
          <HonorariClient initialRows={rows ?? []} locale={locale} />
        </div>
      </div>
    </div>
  );
}
