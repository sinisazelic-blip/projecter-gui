import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rowsRaw = await query(
      `SELECT posting_id, value_date, amount, currency, counterparty, description
       FROM v_bank_posting_unlinked
       ORDER BY posting_id DESC`,
    );
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

    const ownerPrivateAccountRaw = process.env.FLUXA_OWNER_PRIVATE_ACCOUNT?.trim() || "";
    const ownerDigits = ownerPrivateAccountRaw.replace(/\D+/g, "");
    const transferWords = ["prenos", "posudba vlasnika", "uplata vlasnika"];
    const filtered =
      ownerDigits.length > 0
        ? rows.filter((r) => {
            const text = `${r?.counterparty || ""} ${r?.description || ""}`.toLowerCase();
            const digits = String(text).replace(/\D+/g, "");
            const ownerHit = digits.includes(ownerDigits);
            const transferHit = transferWords.some((w) => text.includes(w));
            // Sakrij owner transfer iz unlinked liste (obrađuje se kroz blagajnu tokom commit-a).
            return !(ownerHit && transferHit);
          })
        : rows;

    return NextResponse.json({ ok: true, rows: filtered || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
