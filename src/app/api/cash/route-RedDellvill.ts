import { NextRequest, NextResponse } from "next/server";
import { assertOwner } from "@/lib/auth/owner";
import {
  listCashFromDb,
  insertCashDraftDb,
  computeBalanceFromItems,
  type ListCashFilters,
} from "@/lib/cash/db";
import { query } from "@/lib/db";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET(req: NextRequest) {
  try {
    // assertOwner(req);

    const url = new URL(req.url);
    const dateFrom = (url.searchParams.get("date_from") ?? "").trim() || null;
    const dateTo = (url.searchParams.get("date_to") ?? "").trim() || null;
    const entityType = (url.searchParams.get("entity_type") ?? "").trim() || null;
    const entityId = intOrNull(url.searchParams.get("entity_id"));
    const includeStorno = url.searchParams.get("include_storno") === "1";
    const limit = Math.min(Math.max(1, intOrNull(url.searchParams.get("limit")) ?? 500), 2000);

    const filters: ListCashFilters = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      entityType: entityType || undefined,
      entityId: entityId ?? undefined,
      includeAllStatuses: includeStorno,
      limit,
    };

    const items = await listCashFromDb(filters);
    const balance = computeBalanceFromItems(items);

    return NextResponse.json({ ok: true, balance, items });
  } catch (e: any) {
    return jsonError(e.message || "SERVER_ERROR", e?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  // Privremeno uklonjeno dok se ne implementira server-side autentikacija
  // try {
  //   assertOwner(req);
  // } catch (authError: any) {
  //   console.error("Auth error in /api/cash POST:", authError);
  //   return jsonError(authError?.message || "AUTENTIKACIJA_NEUSPJELA", authError?.status || 401);
  // }

  try {
    const body = await req.json();
    console.log("POST /api/cash body:", body);

    const amount = Number(body?.amount);
    const direction = body?.direction;
    const currency = (body?.currency ?? "KM").toString();
    const note = (body?.note ?? "").toString();
    const projectId = body?.projectId ? String(body.projectId) : null;
    const entityType = body?.entityType ? String(body.entityType) : null; // "talent" | "vendor" | null
    const entityId = body?.entityId ? Number(body.entityId) : null;
    const date = body?.date ? String(body.date) : undefined;

    if (!Number.isFinite(amount) || amount <= 0)
      return jsonError("INVALID_AMOUNT");
    if (direction !== "IN" && direction !== "OUT")
      return jsonError("INVALID_DIRECTION");
    if (!currency) return jsonError("INVALID_CURRENCY");
    if (!note.trim()) return jsonError("NOTE_REQUIRED");

    let projectArchived = false;
    let projectInfo = null;

    // ✅ Ako je projectId dat, arhiviraj projekat (status 10)
    if (projectId) {
      const projIdNum = Number(projectId);
      if (Number.isFinite(projIdNum) && projIdNum > 0) {
        try {
          // Provjeri da li projekat postoji i dohvati info
          const projRows = await query(
            `SELECT projekat_id, id_po, radni_naziv FROM projekti WHERE projekat_id = ?`,
            [projIdNum]
          );
          
          if (projRows && projRows.length > 0) {
            const proj = projRows[0] as any;
            projectInfo = {
              id: proj.projekat_id,
              id_po: proj.id_po,
              naziv: proj.radni_naziv,
            };

            // Ažuriraj status na Arhiviran (10)
            await query(
              `UPDATE projekti SET status_id = 10 WHERE projekat_id = ?`,
              [projIdNum]
            );
            projectArchived = true;
          }
        } catch (e: any) {
          console.error("Greška pri arhiviranju projekta:", e);
          // Ne prekidamo - cash entry se i dalje kreira
        }
      }
    }

    // Formiraj detalje transakcije
    let transactionDetails: string | undefined;
    let paymentCreated = false;
    let paymentId: number | null = null;

    if (projectArchived && projectInfo) {
      const projLabel = projectInfo.id_po 
        ? `#${projectInfo.id_po}` 
        : `#${projectInfo.id}`;
      transactionDetails = `Projekat ${projLabel} arhiviran`;
    }

    // ✅ Ako je talent ili dobavljač, kreiraj plaćanje u bazi
    if ((entityType === "talent" || entityType === "vendor") && entityId && direction === "OUT") {
      try {
        const iznosKm = currency === "KM" || currency === "BAM" ? amount : amount; // TODO: konverzija ako treba
        const datumPlacanja = date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        
        // Kreiraj plaćanje u `placanja` tabeli
        const placanjeRes = await query(
          `INSERT INTO placanja 
            (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, napomena)
           VALUES (?, ?, ?, 1.000000, ?, 'keš', ?)`,
          [datumPlacanja, iznosKm, currency === "BAM" ? "BAM" : currency, iznosKm, note]
        );
        
        const res = placanjeRes as { insertId?: number; rows?: { insertId?: number } } | undefined;
        paymentId = res?.insertId ?? res?.rows?.insertId ?? null;
        
        if (paymentId) {
          paymentCreated = true;
          
          // Pronađi troškove za ovog talenta/dobavljača koji nisu plaćeni
          const troskoviRows = await query(
            `SELECT trosak_id, iznos_km, 
                    COALESCE(SUM(ps.iznos_km), 0) AS placeno_km
             FROM projektni_troskovi t
             LEFT JOIN placanja_stavke ps ON ps.trosak_id = t.trosak_id
             WHERE t.entity_type = ? AND t.entity_id = ? 
               AND t.status <> 'STORNIRANO'
             GROUP BY t.trosak_id, t.iznos_km
             HAVING (t.iznos_km - COALESCE(SUM(ps.iznos_km), 0)) > 0
             ORDER BY t.datum_nastanka ASC
             LIMIT 50`,
            [entityType, entityId]
          ) as any[];

          // Ažuriraj početno stanje ako nema troškova ili ako je iznos veći od postojećih troškova
          if (!troskoviRows || troskoviRows.length === 0) {
            // Ažuriraj početno stanje
            if (entityType === "talent") {
              await query(
                `UPDATE talent_pocetno_stanje 
                 SET iznos_duga = GREATEST(0, iznos_duga - ?)
                 WHERE talent_id = ? AND COALESCE(otpisano, 0) = 0`,
                [iznosKm, entityId]
              );
            } else if (entityType === "vendor") {
              await query(
                `UPDATE dobavljac_pocetno_stanje 
                 SET iznos_duga = GREATEST(0, iznos_duga - ?)
                 WHERE dobavljac_id = ? AND COALESCE(otpisano, 0) = 0`,
                [iznosKm, entityId]
              );
            }
          } else {
            // Veži plaćanje na troškove
            let remaining = iznosKm;
            for (const trosak of troskoviRows) {
              if (remaining <= 0) break;
              
              const trosakId = trosak.trosak_id;
              const duguje = Number(trosak.iznos_km) - Number(trosak.placeno_km || 0);
              const zaPlatiti = Math.min(remaining, duguje);
              
              if (zaPlatiti > 0) {
                await query(
                  `INSERT INTO placanja_stavke (placanje_id, trosak_id, iznos_km)
                   VALUES (?, ?, ?)
                   ON DUPLICATE KEY UPDATE iznos_km = iznos_km + ?`,
                  [paymentId, trosakId, zaPlatiti, zaPlatiti]
                );
                remaining -= zaPlatiti;
              }
            }
            
            // Ako je ostalo nešto, ažuriraj početno stanje
            if (remaining > 0) {
              if (entityType === "talent") {
                await query(
                  `UPDATE talent_pocetno_stanje 
                   SET iznos_duga = GREATEST(0, iznos_duga - ?)
                   WHERE talent_id = ? AND COALESCE(otpisano, 0) = 0`,
                  [remaining, entityId]
                );
              } else if (entityType === "vendor") {
                await query(
                  `UPDATE dobavljac_pocetno_stanje 
                   SET iznos_duga = GREATEST(0, iznos_duga - ?)
                   WHERE dobavljac_id = ? AND COALESCE(otpisano, 0) = 0`,
                  [remaining, entityId]
                );
              }
            }
          }

          // Formiraj detalje transakcije
          const entityName = entityType === "talent" 
            ? (await query(`SELECT ime_prezime FROM talenti WHERE talent_id = ?`, [entityId]) as any[])?.[0]?.ime_prezime || `Talent #${entityId}`
            : (await query(`SELECT naziv FROM dobavljaci WHERE dobavljac_id = ?`, [entityId]) as any[])?.[0]?.naziv || `Dobavljač #${entityId}`;
          
          const ccyLabel = currency === "BAM" || currency === "KM" ? "KM" : currency;
          transactionDetails = `${entityType === "talent" ? "Talent" : "Dobavljač"}: ${entityName} - Plaćeno ${iznosKm.toFixed(2)} ${ccyLabel}`;
        }
      } catch (e: any) {
        console.error("Greška pri kreiranju plaćanja za talent/dobavljač:", e);
        // Ne prekidamo - cash entry se i dalje kreira
      }
    }

    const created = await insertCashDraftDb({
      date,
      amount,
      currency,
      direction,
      note,
      projectId,
      entityType,
      entityId,
      transactionDetails: transactionDetails ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      item: created,
      projectArchived,
      projectInfo,
      paymentCreated,
      paymentId,
    }, { status: 201 });
  } catch (e: any) {
    return jsonError(e.message || "SERVER_ERROR", e?.status || 500);
  }
}
