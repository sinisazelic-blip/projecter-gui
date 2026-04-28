import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

type Tip = "klijent" | "dobavljac" | "talent";

function bad(msg: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}

function isTip(v: unknown): v is Tip {
  return v === "klijent" || v === "dobavljac" || v === "talent";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tip = url.searchParams.get("tip");
    const refIdRaw = url.searchParams.get("ref_id");
    const ref_id = Number(refIdRaw);
    if (!isTip(tip) || !Number.isFinite(ref_id) || ref_id <= 0) {
      return bad("Obavezno: tip (klijent|dobavljac|talent) i ref_id (broj > 0)");
    }

    const rows = await query(
      `
      SELECT uplata_id, tip, ref_id, posting_id, datum, amount_km, napomena, aktivan, created_at
      FROM pocetno_stanje_uplate
      WHERE tip = ? AND ref_id = ?
      ORDER BY datum DESC, uplata_id DESC
      LIMIT 200
      `,
      [tip, ref_id],
    );

    return NextResponse.json({ ok: true, rows: rows || [] });
  } catch (e: any) {
    return bad(e?.message ?? "Greška", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tip = body?.tip as unknown;
    const ref_id = Number(body?.ref_id);
    const posting_id =
      body?.posting_id === null || body?.posting_id === undefined || body?.posting_id === ""
        ? null
        : Number(body?.posting_id);
    const datum = String(body?.datum || "");
    const amount_km = Number(body?.amount_km);
    const napomena =
      typeof body?.napomena === "string" ? body.napomena.trim().slice(0, 255) : null;

    if (!isTip(tip) || !Number.isFinite(ref_id) || ref_id <= 0) {
      return bad("Obavezno: tip (klijent|dobavljac|talent) i ref_id (broj > 0)");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      return bad("datum mora biti YYYY-MM-DD");
    }
    if (!Number.isFinite(amount_km) || amount_km <= 0) {
      return bad("amount_km mora biti > 0");
    }
    if (posting_id !== null && (!Number.isFinite(posting_id) || posting_id <= 0)) {
      return bad("posting_id nevalidan");
    }

    // Optional: validate posting exists + direction makes sense
    if (posting_id != null) {
      const p = await query(
        `SELECT posting_id, amount
         FROM bank_tx_posting
         WHERE posting_id = ?
         LIMIT 1`,
        [posting_id],
      );
      if (!p?.length) return bad("Bank posting ne postoji", 404, { posting_id });
      const amt = Number(p[0]?.amount);
      if (tip === "klijent" && !(amt > 0)) {
        return bad("Za klijenta je potreban priliv (amount > 0) bank posting.", 400, {
          posting_amount: amt,
        });
      }
      if ((tip === "dobavljac" || tip === "talent") && !(amt < 0)) {
        return bad("Za dobavljača/talenta je potreban odliv (amount < 0) bank posting.", 400, {
          posting_amount: amt,
        });
      }
    }

    await query(
      `
      INSERT INTO pocetno_stanje_uplate
        (tip, ref_id, posting_id, datum, amount_km, napomena, aktivan)
      VALUES
        (?, ?, ?, ?, ?, ?, 1)
      `,
      [tip, ref_id, posting_id, datum, Number(amount_km.toFixed(2)), napomena],
    );

    revalidatePath("/finance/pocetna-stanja");
    revalidatePath("/finance/potrazivanja");
    revalidatePath("/naplate");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? "Greška";
    if (String(msg).includes("pocetno_stanje_uplate")) {
      return bad(
        "Tabela pocetno_stanje_uplate ne postoji. Pokreni migraciju: scripts/migrations/2026-04-28_pocetno_stanje_uplate.sql",
        500,
      );
    }
    return bad(msg, 500);
  }
}

