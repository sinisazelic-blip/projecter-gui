import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD
    const type = searchParams.get("type"); // VLASNIK / OSTALO / ...
    const q = searchParams.get("q");       // search tekst

    const where = [];
    const params = [];

    if (from) {
      where.push("booking_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("booking_date <= ?");
      params.push(to);
    }
    if (type) {
      where.push("counterparty_type = ?");
      params.push(type);
    }
    if (q) {
      where.push("(counterparty_name LIKE ? OR description LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await query(
      `
      SELECT
        id,
        bank_txn_id,
        DATE_FORMAT(booking_date, '%Y-%m-%d') AS booking_date,
        DATE_FORMAT(value_date, '%Y-%m-%d') AS value_date,
        amount,
        currency,
        counterparty_name,
        counterparty_account,
        description,
        reference,
        counterparty_type,
        is_internal_transfer,
        created_at
      FROM bank_transakcije
      ${whereSql}
      ORDER BY booking_date DESC, id DESC
      LIMIT 500
      `,
      params
    );

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Greška pri čitanju transakcija." },
      { status: 500 }
    );
  }
}
