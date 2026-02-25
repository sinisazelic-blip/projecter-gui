// GET: lista ponuda po deal-u (?inicijacija_id=)
// POST: kreiraj novu ponudu iz deal-a (body: { inicijacija_id } ili iz wizarda sa stavke[], datum_*, popust_km)
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { query } from "@/lib/db";

function asInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return x <= 0 ? null : x;
}

function normCcy(v: any): string {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "KM") return "KM";
  return (s || "BAM").slice(0, 3) === "BAM" ? "KM" : s.slice(0, 3);
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicijacija_id = asInt(searchParams.get("inicijacija_id"));
    if (!inicijacija_id) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje inicijacija_id." },
        { status: 400 },
      );
    }
    const rows = await query(
      `
      SELECT
        p.ponuda_id,
        p.inicijacija_id,
        p.godina,
        p.broj_u_godini,
        CONCAT('P', LPAD(p.broj_u_godini, 3, '0'), '/', p.godina) AS broj_ponude,
        p.datum_izdavanja,
        p.datum_vazenja,
        p.klijent_id,
        p.valuta,
        p.created_at
      FROM ponude p
      WHERE p.inicijacija_id = ?
      ORDER BY p.created_at DESC
      `,
      [inicijacija_id],
    );
    return NextResponse.json({ ok: true, rows: rows ?? [] });
  } catch (e: any) {
    // Ako tabela ponude ne postoji (nije pokrenut create-ponude.sql), vrati praznu listu
    const msg = e?.message ?? "";
    if (msg.includes("ponude") || msg.includes("doesn't exist") || msg.includes("Unknown table")) {
      return NextResponse.json({ ok: true, rows: [] });
    }
    return NextResponse.json(
      { ok: false, error: msg || "Greška (GET ponude)" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inicijacija_id = asInt(body.inicijacija_id);
    if (!inicijacija_id) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje inicijacija_id." },
        { status: 400 },
      );
    }

    const conn = await pool.getConnection();
    try {
      // 1) Deal + klijent i valuta
      const [dealRows]: any = await conn.query(
        `
        SELECT i.inicijacija_id, i.narucilac_id, i.krajnji_klijent_id,
               k.naziv_klijenta, k.drzava, COALESCE(k.is_ino, 0) AS is_ino
        FROM inicijacije i
        LEFT JOIN klijenti k ON k.klijent_id = i.narucilac_id
        WHERE i.inicijacija_id = ?
        LIMIT 1
        `,
        [inicijacija_id],
      );
      const deal = Array.isArray(dealRows) && dealRows.length ? dealRows[0] : null;
      if (!deal) {
        return NextResponse.json(
          { ok: false, error: "Deal nije pronađen." },
          { status: 404 },
        );
      }
      const klijent_id = deal.narucilac_id ?? deal.krajnji_klijent_id;
      if (!klijent_id) {
        return NextResponse.json(
          { ok: false, error: "Deal nema naručioca ni krajnjeg klijenta." },
          { status: 400 },
        );
      }
      const isIno = Number(deal.is_ino ?? 0) === 1;
      const valutaFromBody = body.valuta != null ? normCcy(body.valuta) : null;
      const valuta = valutaFromBody ?? (isIno ? "EUR" : "KM");

      // 2) Stavke: iz body (wizard) ili učitaj iz deal-a
      let stavke: any[];
      if (Array.isArray(body.stavke) && body.stavke.length > 0) {
        stavke = body.stavke.map((s: any) => ({
          naziv_snapshot: s.naziv_snapshot ?? "",
          jedinica_snapshot: s.jedinica_snapshot ?? "kom",
          kolicina: Number(s.kolicina ?? 0),
          cijena_jedinicna: Number(s.cijena_jedinicna ?? 0),
          valuta: normCcy(s.valuta ?? valuta),
          opis: (s.opis ?? null) && String(s.opis).trim() ? String(s.opis).slice(0, 500) : null,
          line_total: Number(s.line_total ?? 0),
        }));
      } else {
        let stavkeSql = `
          SELECT naziv_snapshot, COALESCE(jedinica_snapshot, 'kom') AS jedinica_snapshot,
                 kolicina, cijena_jedinicna, valuta, opis, line_total
          FROM inicijacija_stavke
          WHERE inicijacija_id = ?
        `;
        const [colRows]: any = await conn.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inicijacija_stavke' AND COLUMN_NAME = 'stornirano' LIMIT 1`,
        );
        if (Array.isArray(colRows) && colRows.length) {
          stavkeSql += " AND stornirano = 0";
        }
        stavkeSql += " ORDER BY inicijacija_stavka_id ASC";
        const [stavkeRows]: any = await conn.query(stavkeSql, [inicijacija_id]);
        stavke = Array.isArray(stavkeRows) ? stavkeRows : [];
      }
      if (stavke.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Nema stavki za ponudu (dodaj stavke u deal ili u wizardu)." },
          { status: 400 },
        );
      }

      const datumIzdavanja =
        typeof body.datum_izdavanja === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.datum_izdavanja)
          ? body.datum_izdavanja
          : new Date().toISOString().slice(0, 10);
      let datumVazenjaStr: string;
      if (typeof body.datum_vazenja === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.datum_vazenja)) {
        datumVazenjaStr = body.datum_vazenja;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        datumVazenjaStr = d.toISOString().slice(0, 10);
      }
      const godina = new Date().getFullYear();
      const popustKm =
        body.popust_km != null && Number.isFinite(Number(body.popust_km))
          ? Math.max(0, Number(body.popust_km))
          : null;

      // 3) Sljedeći broj P u godini
      const [maxRows]: any = await conn.query(
        `SELECT COALESCE(MAX(broj_u_godini), 0) AS m FROM ponude WHERE godina = ?`,
        [godina],
      );
      const sledeciBroj = Number(maxRows?.[0]?.m ?? 0) + 1;

      // 4) Insert ponude (s popust_km ako kolona postoji)
      const hasPopustKmCol = await hasColumn("ponude", "popust_km");
      let insPonudaResult: any;
      if (hasPopustKmCol) {
        [insPonudaResult] = await conn.query(
          `INSERT INTO ponude
            (inicijacija_id, godina, broj_u_godini, datum_izdavanja, datum_vazenja, klijent_id, valuta, popust_km)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [inicijacija_id, godina, sledeciBroj, datumIzdavanja, datumVazenjaStr, klijent_id, valuta, popustKm ?? 0],
        );
      } else {
        [insPonudaResult] = await conn.query(
          `INSERT INTO ponude
            (inicijacija_id, godina, broj_u_godini, datum_izdavanja, datum_vazenja, klijent_id, valuta)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inicijacija_id, godina, sledeciBroj, datumIzdavanja, datumVazenjaStr, klijent_id, valuta],
        );
      }
      const ponuda_id = Number(insPonudaResult?.insertId ?? 0);
      if (!ponuda_id) {
        return NextResponse.json(
          { ok: false, error: "Kreiranje ponude nije uspjelo." },
          { status: 500 },
        );
      }

      // 5) Insert stavke (snapshot)
      for (const s of stavke) {
        const line_total = Number(s.line_total ?? 0);
        const ccy = normCcy(s.valuta);
        await conn.query(
          `INSERT INTO ponuda_stavke
            (ponuda_id, naziv_snapshot, jedinica_snapshot, kolicina, cijena_jedinicna, valuta, opis, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ponuda_id,
            String(s.naziv_snapshot ?? "").slice(0, 500),
            String(s.jedinica_snapshot ?? "kom").slice(0, 50),
            Number(s.kolicina ?? 0),
            Number(s.cijena_jedinicna ?? 0),
            ccy,
            (s.opis ?? null) ? String(s.opis).slice(0, 500) : null,
            line_total,
          ],
        );
      }

      const broj_ponude = `P${String(sledeciBroj).padStart(3, "0")}/${godina}`;
      return NextResponse.json({
        ok: true,
        ponuda_id,
        broj_ponude,
        inicijacija_id,
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška (POST ponude)" },
      { status: 500 },
    );
  }
}
