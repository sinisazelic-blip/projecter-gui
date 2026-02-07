import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let conn;
  try {
    const url = new URL(req.url);

    // ✅ NOVO: projekat filter
    const projekatIdRaw = url.searchParams.get("projekat_id");

    // filteri
    const onlyLate = url.searchParams.get("only_late") === "1";
    const fakt = url.searchParams.get("fakturisano"); // "1" | "0" | null
    const narIdRaw = url.searchParams.get("narucilac_id");
    const dueFrom = url.searchParams.get("due_from"); // YYYY-MM-DD
    const dueTo = url.searchParams.get("due_to"); // YYYY-MM-DD

    // default: pokaži stvari koje dospijevaju uskoro (npr. 14 dana) ili kasne
    const upcomingDaysRaw = url.searchParams.get("upcoming_days");
    const upcomingDays = upcomingDaysRaw ? Number(upcomingDaysRaw) : 14;

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || "25060"),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
      connectTimeout: 8000,
    });

    const where = [];
    const args = [];

    // Naplate: završeni/archived (kako smo se dogovorili)
    where.push("p.status_id IN (4, 6)");

    // nije plaćeno (default logika naplate)
    where.push("(v.placeno_datum IS NULL)");

    // ✅ NOVO: projekat filter (ako je došao u URL-u)
    if (projekatIdRaw && Number.isFinite(Number(projekatIdRaw))) {
      where.push("v.projekat_id = ?");
      args.push(Number(projekatIdRaw));
    }

    // only late
    if (onlyLate) {
      where.push("v.naplata_status = 'kasni'");
    } else {
      // pametan default: ili kasni ili dospijeva uskoro (ako ima valutu)
      // a projekte bez valute ćemo sakriti dok korisnik ne odabere filtere (jer ih je previše)
      where.push(
        "(v.naplata_status = 'kasni' OR (v.datum_valute IS NOT NULL AND v.dana_do_valute BETWEEN 0 AND ?))"
      );
      args.push(Number.isFinite(upcomingDays) ? upcomingDays : 14);
    }

    // fakturisano filter
    if (fakt === "1" || fakt === "0") {
      where.push("v.fakturisano = ?");
      args.push(Number(fakt));
    }

    // naručilac filter
    if (narIdRaw && Number.isFinite(Number(narIdRaw))) {
      where.push("v.narucilac_id = ?");
      args.push(Number(narIdRaw));
    }

    // valuta range filter
    if (dueFrom) {
      where.push("v.datum_valute >= ?");
      args.push(dueFrom);
    }
    if (dueTo) {
      where.push("v.datum_valute <= ?");
      args.push(dueTo);
    }

    const sql = `
      SELECT v.*
      FROM vw_naplate v
      JOIN projekti p ON p.projekat_id = v.projekat_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY
        v.dana_kasni DESC,
        v.datum_valute ASC,
        v.projekat_id DESC
      LIMIT 500;
    `;

    const [rows] = await conn.query(sql, args);

    return NextResponse.json({ ok: true, success: true, data: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, success: false, error: e?.message || String(e), code: e?.code },
      { status: 500 }
    );
  } finally {
    if (conn) await conn.end();
  }
}
