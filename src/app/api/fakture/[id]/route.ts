// src/app/api/fakture/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const fakturaId = Number(p.id);

    if (!Number.isFinite(fakturaId) || fakturaId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Neispravan ID fakture" },
        { status: 400 },
      );
    }

    // Učitaj fakturu
    let fakturaRows: any = [];
    try {
      fakturaRows = await query(
        `
        SELECT
          f.faktura_id,
          f.broj_fakture_puni AS broj_fakture,
          f.broj_fiskalni,
          f.datum_izdavanja,
          f.bill_to_klijent_id AS narucilac_id,
          k.naziv_klijenta AS narucilac_naziv,
          k.rok_placanja_dana,
          f.osnovica_km AS iznos_bez_pdv,
          f.pdv_iznos_km AS pdv_iznos,
          f.iznos_ukupno_km AS iznos_sa_pdv,
          f.valuta,
          f.fiskalni_status AS status,
          f.created_at
        FROM fakture f
        LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
        WHERE f.faktura_id = ?
        LIMIT 1
        `,
        [fakturaId],
      );
    } catch (queryErr: any) {
      console.error(`❌ Greška pri učitavanju fakture ${fakturaId}:`, queryErr?.message);
      console.error(`   Stack:`, queryErr?.stack);
      throw new Error(`Greška pri učitavanju fakture: ${queryErr?.message}`);
    }

    if (!fakturaRows || fakturaRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faktura nije pronađena" },
        { status: 404 },
      );
    }

    const faktura = fakturaRows[0];

    // Formatiraj broj fakture ako je potrebno (npr. "6/2026" -> "006/2026")
    let brojFaktureFormatiran = faktura.broj_fakture;
    if (faktura.broj_fakture && typeof faktura.broj_fakture === "string") {
      const parts = faktura.broj_fakture.split("/");
      if (parts.length === 2) {
        const broj = parts[0];
        const godina = parts[1];
        if (/^\d+$/.test(broj) && /^\d{4}$/.test(godina)) {
          brojFaktureFormatiran = `${String(Number(broj)).padStart(3, "0")}/${godina}`;
        }
      }
    }

    // Izračunaj datum dospijeća (datum_izdavanja + rok_placanja_dana)
    let datumDospijeca = null;
    if (faktura.datum_izdavanja && faktura.rok_placanja_dana) {
      const datum = new Date(faktura.datum_izdavanja);
      datum.setDate(datum.getDate() + Number(faktura.rok_placanja_dana));
      datumDospijeca = datum.toISOString().slice(0, 10);
    }

    // Učitaj projekte vezane za fakturu
    let projektiIds: number[] = [];
    
    // Učitaj projekte i opisne stavke iz faktura_projekti
    let projectSubItems: Record<number, string[]> = {};
    try {
      const projektiRows: any = await query(
        `SELECT projekat_id, opisne_stavke FROM faktura_projekti WHERE faktura_id = ?`,
        [fakturaId],
      );
      if (Array.isArray(projektiRows) && projektiRows.length > 0) {
        projektiIds = projektiRows
          .map((r: any) => Number(r.projekat_id))
          .filter(Number.isFinite);
        // Parse opisne_stavke JSON
        for (const r of projektiRows) {
          const pid = Number(r.projekat_id);
          if (!Number.isFinite(pid)) continue;
          let items: string[] = [];
          try {
            if (r.opisne_stavke) {
              const parsed = typeof r.opisne_stavke === "string"
                ? JSON.parse(r.opisne_stavke)
                : r.opisne_stavke;
              items = Array.isArray(parsed)
                ? parsed.map((s: any) => String(s ?? "").trim()).filter(Boolean)
                : [];
            }
          } catch (_) {}
          if (items.length > 0) projectSubItems[pid] = items;
        }
        console.log(`✅ Pronađeno ${projektiIds.length} projekata iz faktura_projekti za fakturu ${fakturaId}`);
      }
    } catch (err: any) {
      // Ako opisne_stavke kolona ne postoji, pokušaj bez nje
      const errMsg = String(err?.message || "").toLowerCase();
      if (errMsg.includes("unknown column") && errMsg.includes("opisne_stavke")) {
        try {
          const projektiRowsFallback: any = await query(
            `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ?`,
            [fakturaId],
          );
          if (Array.isArray(projektiRowsFallback) && projektiRowsFallback.length > 0) {
            projektiIds = projektiRowsFallback
              .map((r: any) => Number(r.projekat_id))
              .filter(Number.isFinite);
          }
        } catch (_) {}
      }
      if (projektiIds.length === 0) {
        console.warn(`⚠️ Greška pri učitavanju iz faktura_projekti za fakturu ${fakturaId}:`, err?.message);
      }
    }

    // Fallback: ako nema veza u faktura_projekti, pokušaj da nađeš preko project_audit
    if (projektiIds.length === 0) {
      console.log(`🔍 Pokušavam fallback: učitavanje projekata iz project_audit za fakturu ${fakturaId}`);
      try {
        // Prvo pokušaj sa JSON_EXTRACT (ako je details JSON kolona)
        let auditRows: any = [];
        try {
          auditRows = await query(
            `
            SELECT DISTINCT projekat_id
            FROM project_audit
            WHERE action = 'PROJECT_INVOICED'
            AND CAST(JSON_EXTRACT(details, '$.faktura_id') AS UNSIGNED) = ?
            `,
            [fakturaId],
          );
        } catch (jsonErr: any) {
          // Ako JSON_EXTRACT ne radi, pokušaj sa LIKE pretragom (ako je details TEXT)
          console.log(`   JSON_EXTRACT ne radi, pokušavam sa LIKE pretragom`);
          auditRows = await query(
            `
            SELECT DISTINCT projekat_id
            FROM project_audit
            WHERE action = 'PROJECT_INVOICED'
            AND details LIKE ?
            `,
            [`%"faktura_id":${fakturaId}%`],
          );
        }
        
        console.log(`   Pronađeno ${Array.isArray(auditRows) ? auditRows.length : 0} audit zapisa`);
        
        if (Array.isArray(auditRows) && auditRows.length > 0) {
          projektiIds = auditRows
            .map((r: any) => Number(r.projekat_id))
            .filter(Number.isFinite)
            .filter((id, index, self) => self.indexOf(id) === index); // ukloni duplikate
          console.log(`✅ Pronađeno ${projektiIds.length} projekata iz audit loga za fakturu ${fakturaId}: ${projektiIds.join(", ")}`);
        } else {
          console.warn(`⚠️ Nema audit zapisa za fakturu ${fakturaId}`);
        }
      } catch (err: any) {
        // Ako ni audit log ne radi, ignorišemo
        console.error(`❌ Greška pri učitavanju projekata iz audit loga za fakturu ${fakturaId}:`, err?.message);
        console.error(`   Stack:`, err?.stack);
      }
    }
    
    if (projektiIds.length === 0) {
      console.warn(`⚠️ Faktura ${fakturaId} nema povezanih projekata ni iz faktura_projekti ni iz audit loga`);
    }

    return NextResponse.json({
      ok: true,
      faktura: {
        ...faktura,
        broj_fakture: brojFaktureFormatiran,
        datum_dospijeca: datumDospijeca,
        projekti_ids: projektiIds,
        project_sub_items: projectSubItems,
      },
    });
  } catch (err: any) {
    console.error(`❌ Greška u API /api/fakture/${fakturaId}:`, err?.message);
    console.error(`   Stack:`, err?.stack);
    return NextResponse.json(
      { 
        ok: false, 
        error: err?.message ?? "Greška na serveru",
        debug: process.env.NODE_ENV === 'development' ? {
          message: err?.message,
          stack: err?.stack,
          fakturaId,
        } : undefined,
      },
      { status: 500 },
    );
  }
}
