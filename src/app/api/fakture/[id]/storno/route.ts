// src/app/api/fakture/[id]/storno/route.ts
// Storno fakture: kreira storno račun (negativni iznosi), projekti vraćaju u status 8 (Zatvoren)
import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("fakture");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const originalFakturaId = getIdFromUrl(req);
  if (!originalFakturaId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const conn = await (pool as any).getConnection();

  try {
    await conn.beginTransaction();

    // 1) Učitaj originalnu fakturu
    const [fakturaRows]: any = await conn.query(
      `SELECT faktura_id, bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni,
              datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
              pdv_obracunat, iznos_ukupno_km, fiskalni_status
       FROM fakture WHERE faktura_id = ? LIMIT 1`,
      [originalFakturaId],
    );

    if (!fakturaRows || fakturaRows.length === 0) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Faktura nije pronađena." },
        { status: 404 },
      );
    }

    const orig = fakturaRows[0];

    // Ne dozvoli storno ako je već storno (negativni iznosi)
    if (Number(orig.osnovica_km ?? 0) < 0) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Ova faktura je već storno račun." },
        { status: 409 },
      );
    }

    // 2) Učitaj projekte vezane za fakturu
    let projekatIds: number[] = [];
    const [fpRows]: any = await conn.query(
      `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ?`,
      [originalFakturaId],
    );
    if (fpRows && fpRows.length > 0) {
      projekatIds = fpRows.map((r: any) => Number(r.projekat_id)).filter(Number.isFinite);
    }

    // Fallback: project_audit
    if (projekatIds.length === 0) {
      const [auditRows]: any = await conn.query(
        `SELECT DISTINCT projekat_id FROM project_audit
         WHERE action = 'PROJECT_INVOICED' AND details LIKE ?`,
        [`%"faktura_id":${originalFakturaId}%`],
      );
      if (auditRows?.length) {
        projekatIds = [...new Set(auditRows.map((r: any) => Number(r.projekat_id)).filter(Number.isFinite))];
      }
    }

    // 3) Sledeći broj i PFR za storno
    const godina = Number(orig.godina) || new Date().getFullYear();
    const [maxRows]: any = await conn.query(
      `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM fakture WHERE godina = ?`,
      [godina],
    );
    const sledeciBroj = (Number(maxRows?.[0]?.m ?? 0) || 0) + 1;

    let pfrBroj: number | null = null;
    try {
      const [pfrRows]: any = await conn.query(
        `SELECT MAX(broj_fiskalni) AS max_pfr FROM fakture WHERE broj_fiskalni IS NOT NULL`,
      );
      const maxPfr = Number(pfrRows?.[0]?.max_pfr ?? 0) || 0;
      pfrBroj = maxPfr + 1;
    } catch {
      pfrBroj = 1;
    }

    // 4) Negativni iznosi
    const osnovicaKm = -(Number(orig.osnovica_km) || 0);
    const pdvIznosKm = -(Number(orig.pdv_iznos_km) || 0);
    const iznosUkupnoKm = -(Number(orig.iznos_ukupno_km) || 0);

    // 6) Kreiraj storno fakturu (tip mora biti obicna/multi — ENUM ne podržava storno)
    const datumStorno = new Date().toISOString().slice(0, 10);
    const tipStorno = orig.tip === "multi" ? "multi" : "obicna";
    const valuta = String(orig.valuta || "BAM").toUpperCase() === "KM" ? "BAM" : String(orig.valuta || "BAM").toUpperCase();

    const [insertResult]: any = await conn.query(
      `INSERT INTO fakture
        (bill_to_klijent_id, godina, broj_u_godini, broj_fiskalni, fiskalni_status,
         datum_izdavanja, tip, valuta, osnovica_km, pdv_stopa, pdv_iznos_km,
         pdv_obracunat, iznos_ukupno_km)
       VALUES (?, ?, ?, ?, 'STORNIRAN', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orig.bill_to_klijent_id,
        godina,
        sledeciBroj,
        pfrBroj,
        datumStorno,
        tipStorno,
        valuta,
        osnovicaKm,
        Number(orig.pdv_stopa) || 0,
        pdvIznosKm,
        Number(orig.pdv_obracunat) ?? 0,
        iznosUkupnoKm,
      ],
    );

    const stornoFakturaId = Number(insertResult.insertId);
    const brojStorno = `${String(sledeciBroj).padStart(3, "0")}/${godina}`;

    // 7) Kopiraj faktura_projekti (opisne stavke, naziv)
    if (projekatIds.length > 0) {
      const [fpFullRows]: any = await conn.query(
        `SELECT projekat_id, opisne_stavke, naziv_na_fakturi FROM faktura_projekti WHERE faktura_id = ?`,
        [originalFakturaId],
      );
      for (const r of fpFullRows || []) {
        try {
          await conn.query(
            `INSERT INTO faktura_projekti (faktura_id, projekat_id, opisne_stavke, naziv_na_fakturi)
             VALUES (?, ?, ?, ?)`,
            [stornoFakturaId, r.projekat_id, r.opisne_stavke ?? null, r.naziv_na_fakturi ?? null],
          );
        } catch (e: any) {
          const errMsg = String(e?.message || "").toLowerCase();
          if (errMsg.includes("unknown column") || errMsg.includes("column count doesn't match")) {
            await conn.query(
              `INSERT INTO faktura_projekti (faktura_id, projekat_id) VALUES (?, ?)`,
              [stornoFakturaId, r.projekat_id],
            );
          } else throw e;
        }
      }
    }

    // 8) Vrati projekte u status 8 (Zatvoren)
    if (projekatIds.length > 0) {
      await conn.query(
        `UPDATE projekti SET status_id = 8 WHERE projekat_id IN (${projekatIds.map(() => "?").join(",")})`,
        projekatIds,
      );

      for (const pid of projekatIds) {
        await conn.query(
          `INSERT INTO project_audit (projekat_id, action, details, user_label, ip)
           VALUES (?, 'PROJECT_STORNO', ?, 'SYSTEM', '127.0.0.1')`,
          [pid, JSON.stringify({ faktura_id: originalFakturaId, storno_faktura_id: stornoFakturaId })],
        );
      }
    }

    await conn.commit();

    return NextResponse.json({
      ok: true,
      message: "Storno račun kreiran. Projekti vraćeni u status Zatvoren.",
      storno_faktura_id: stornoFakturaId,
      broj_storno: brojStorno,
      projekti_ids: projekatIds,
    });
  } catch (err: any) {
    try {
      await conn.rollback();
    } catch {}
    const msg = err?.message ?? "Greška pri storniranju";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        ...(msg.toLowerCase().includes("column count") && {
          hint: "Možda tabela fakture ili faktura_projekti ima drugačiju strukturu. Proverite SHOW COLUMNS FROM fakture; i SHOW COLUMNS FROM faktura_projekti;",
        }),
      },
      { status: 500 },
    );
  } finally {
    conn.release();
  }
}
