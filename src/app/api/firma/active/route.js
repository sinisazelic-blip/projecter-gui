// src/app/api/firma/active/route.js
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await query(
    `
    SELECT *
    FROM firma_profile
    WHERE is_active = 1
    ORDER BY firma_id DESC
    LIMIT 1
    `
  );

  const f = rows?.[0] || null;

  if (!f) {
    return NextResponse.json({
      ok: true,
      firma: { naziv: "Studio TAF", logo_path: "/fluxa/logo-light.png" },
      bank_accounts: [],
      fallback: true,
    });
  }

  const bankAccounts = await query(
    `
    SELECT bank_account_id, bank_naziv, bank_racun, iban, swift, primary_rank
    FROM firma_bank_accounts
    WHERE firma_id = ?
    ORDER BY bank_account_id ASC
    `,
    [f.firma_id]
  );

  return NextResponse.json({ ok: true, firma: f, bank_accounts: bankAccounts });
}
