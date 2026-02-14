import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type Tip = "klijent" | "dobavljac" | "talent";

/**
 * POST: Označi početno stanje kao otpisano (klijent / dobavljač / talent).
 * Body: { tip: 'klijent'|'dobavljac'|'talent', ref_id: number, razlog?: string }
 * Zahtijeva kolone: otpisano, otpis_razlog, otpis_datum (v. scripts-RedDellvill/otpis-duga-kolone.sql).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tip = body?.tip as string;
    const refId = Number(body?.ref_id);
    const razlog = typeof body?.razlog === "string" ? body.razlog.trim() : null;

    const validTips: Tip[] = ["klijent", "dobavljac", "talent"];
    if (!validTips.includes(tip as Tip) || !Number.isFinite(refId) || refId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Obavezno: tip (klijent|dobavljac|talent) i ref_id (broj > 0)" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (tip === "klijent") {
      await query(
        `UPDATE klijent_pocetno_stanje SET otpisano = 1, otpis_razlog = ?, otpis_datum = ? WHERE klijent_id = ?`,
        [razlog || null, today, refId]
      );
    } else if (tip === "dobavljac") {
      await query(
        `UPDATE dobavljac_pocetno_stanje SET otpisano = 1, otpis_razlog = ?, otpis_datum = ? WHERE dobavljac_id = ?`,
        [razlog || null, today, refId]
      );
    } else {
      await query(
        `UPDATE talent_pocetno_stanje SET otpisano = 1, otpis_razlog = ?, otpis_datum = ? WHERE talent_id = ?`,
        [razlog || null, today, refId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unknown column 'otpisano'") || msg.includes("otpis_razlog") || msg.includes("otpis_datum")) {
      return NextResponse.json(
        { ok: false, error: "Kolone za otpis nisu dodane. Pokreni skriptu: scripts-RedDellvill/otpis-duga-kolone.sql" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
