import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getT } from "@/lib/translations";
import { getValidLocale } from "@/lib/i18n";
import { query } from "@/lib/db";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isOwnerLike } from "@/lib/projects/deal-edit-guard";
import FluxaLogo from "@/components/FluxaLogo";
import HonorariClient from "./HonorariClient";

export const dynamic = "force-dynamic";

export default async function TalentHonorariPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;
  if (!session || !isOwnerLike(session)) {
    redirect("/dashboard");
  }

  const locale = getValidLocale(cookieStore.get("NEXT_LOCALE")?.value) ?? "sr";
  const t = getT(locale);

  // 1) Učitaj zbir isplata iz blagajne po talentu (gotovinske isplate saradnicima)
  const blagajnaRows: any = await query(
    `
    SELECT entity_id AS talent_id, SUM(iznos) AS total_paid
    FROM blagajna_stavke
    WHERE entity_type = 'talent' AND smjer = 'OUT' AND status = 'AKTIVAN'
    GROUP BY entity_id
    `,
  ).catch((err) => {
    console.error("Greška pri učitavanju isplata iz blagajne:", err);
    return [];
  });

  const payoutPoolByTalent: Record<number, number> = {};
  for (const r of blagajnaRows || []) {
    payoutPoolByTalent[Number(r.talent_id)] = Number(r.total_paid) || 0;
  }

  // 2) Učitaj istorijska početna stanja (stari dugovi prema talentima)
  const pocetnaRows: any = await query(
    `
    SELECT
      CONCAT('PS-', ps.talent_id) AS trosak_id,
      NULL AS projekat_id,
      'Istorijsko dugovanje / Početno stanje' AS naziv_projekta,
      'Studio TAF obaveza' AS naziv_klijenta,
      tal.talent_id,
      tal.ime_prezime AS talent_naziv,
      tal.vrsta AS talent_vrsta,
      CAST(ps.iznos_duga AS DECIMAL(10,2)) AS honorar_iznos_km,
      COALESCE(ps.napomena, 'Početno stanje duga prema saradniku') AS honorar_opis,
      ps.datum_stanja AS datum_angazmana,
      'POČETNO_STANJE' AS trosak_status,
      NULL AS faktura_id,
      NULL AS broj_fakture,
      NULL AS faktura_datum,
      NULL AS faktura_iznos_km,
      'PLACENO' AS faktura_status_naplate
    FROM talent_pocetno_stanje ps
    JOIN talenti tal ON tal.talent_id = ps.talent_id
    WHERE COALESCE(ps.otpisano, 0) = 0
    ORDER BY ps.datum_stanja ASC, ps.talent_id ASC
    `,
  ).catch((err) => {
    console.error("Greška pri učitavanju početnih stanja talenata:", err);
    return [];
  });

  // 3) Učitaj sve angažmane talenata sa projekata
  const projectRows: any = await query(
    `
    SELECT
      t.trosak_id,
      t.projekat_id,
      p.radni_naziv AS naziv_projekta,
      k.naziv_klijenta,
      tal.talent_id,
      tal.ime_prezime AS talent_naziv,
      tal.vrsta AS talent_vrsta,
      CAST(t.iznos_km AS DECIMAL(10,2)) AS honorar_iznos_km,
      t.opis AS honorar_opis,
      COALESCE(t.datum_troska, t.created_at) AS datum_angazmana,
      t.status AS trosak_status,
      f.faktura_id,
      COALESCE(f.broj_fakture_puni, CONCAT(f.godina, '-', f.broj_u_godini)) AS broj_fakture,
      f.datum_izdavanja AS faktura_datum,
      f.iznos_ukupno_km AS faktura_iznos_km,
      COALESCE(
        CASE 
          WHEN f.fiskalni_status = 'STORNIRAN' THEN 'STORNIRANO'
          WHEN f.faktura_id IS NOT NULL THEN 'PLACENO'
          ELSE 'NEPLACENO'
        END,
        'NEMA_FAKTURE'
      ) AS faktura_status_naplate
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
    WHERE COALESCE(t.status, '') <> 'STORNIRANO'
    ORDER BY datum_angazmana ASC, t.trosak_id ASC
    `,
  ).catch((err) => {
    console.error("Greška pri učitavanju projektnih honorara:", err);
    return [];
  });

  // 4) FIFO raspodjela isplata iz blagajne po svakom talentu pojedinačno
  const allChronological = [...(pocetnaRows || []), ...(projectRows || [])];
  
  // Grupiši stavke po talentu
  const itemsByTalent: Record<number, any[]> = {};
  for (const it of allChronological) {
    const tid = Number(it.talent_id);
    if (!itemsByTalent[tid]) itemsByTalent[tid] = [];
    itemsByTalent[tid].push(it);
  }

  // Raspodijeli raspoloživi iznos isplata iz blagajne hronološki (FIFO)
  const processedRows: any[] = [];
  for (const [tidStr, items] of Object.entries(itemsByTalent)) {
    const tid = Number(tidStr);
    let pool = payoutPoolByTalent[tid] || 0;

    for (const it of items) {
      const iznos = Number(it.honorar_iznos_km) || 0;
      const isplaceno = Math.min(iznos, pool);
      pool = Math.max(0, pool - isplaceno);
      const preostalo = Math.max(0, iznos - isplaceno);

      processedRows.push({
        ...it,
        honorar_iznos_km: iznos,
        vec_isplaceno_km: isplaceno,
        preostalo_km: preostalo,
      });
    }
  }

  // Sortiraj za prikaz: novije prvo, početna stanja na vrhu ili po datumu
  processedRows.sort((a, b) => {
    const da = a.datum_angazmana ? new Date(a.datum_angazmana).getTime() : 0;
    const db = b.datum_angazmana ? new Date(b.datum_angazmana).getTime() : 0;
    return db - da;
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
                    Pregled svih dugovanja, angažmana spikera i saradnika uz status naplate od klijenata
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
          <HonorariClient initialRows={processedRows} locale={locale} />
        </div>
      </div>
    </div>
  );
}
