import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista bankovnih računa firme (za import dropdown).
 * Koristi najniži firma_id koji ima i UCB i Novu (Studio).
 */
export async function GET() {
  try {
    const rows: any[] = await query(
      `
      SELECT bank_account_id, firma_id, bank_naziv, bank_racun, iban, show_on_invoice
      FROM firma_bank_accounts
      WHERE firma_id = (
        SELECT MIN(firma_id) FROM firma_bank_accounts
      )
      ORDER BY bank_account_id ASC
      `,
    );

    const accounts = (rows || []).map((r) => {
      const id = Number(r.bank_account_id);
      const naziv = String(r.bank_naziv || "").trim();
      const short = naziv.toLowerCase().includes("nova")
        ? "Nova Banka"
        : naziv.toLowerCase().includes("unicredit")
          ? "UniCredit"
          : naziv || `Račun ${id}`;
      return {
        bank_account_id: id,
        bank_naziv: naziv,
        label: `${id} — ${short}`,
        bank_racun: r.bank_racun != null ? String(r.bank_racun) : null,
        iban: r.iban != null ? String(r.iban) : null,
      };
    });

    return NextResponse.json({ ok: true, accounts });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
