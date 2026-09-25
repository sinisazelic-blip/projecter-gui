import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const godina = searchParams.get("godina");
    const kategorija = searchParams.get("kategorija");
    const q = searchParams.get("q");

    const where: string[] = [];
    const params: any[] = [];

    if (godina) {
      where.push("godina_obracuna = ?");
      params.push(Number(godina));
    }
    if (kategorija && kategorija !== "ALL") {
      where.push("kategorija = ?");
      params.push(kategorija);
    }
    if (q) {
      where.push("(broj_racuna LIKE ? OR dobavljac LIKE ? OR svrha LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows: any = await query(
      `
      SELECT 
        id,
        broj_racuna,
        DATE_FORMAT(datum_racuna, '%Y-%m-%d') AS datum_racuna,
        dobavljac,
        kategorija,
        iznos_ukupno,
        iznos_osnovica,
        iznos_pdv,
        valuta,
        svrha,
        status_pravdanja,
        godina_obracuna,
        created_at
      FROM mali_racuni
      ${whereSql}
      ORDER BY datum_racuna DESC, id DESC
      `,
      params
    );

    // Zbirna statistika
    const items = rows || [];
    const ukupnoIznos = items.reduce((sum: number, r: any) => sum + Number(r.iznos_ukupno || 0), 0);
    const poreskaUsteda10 = Math.round(ukupnoIznos * 0.10 * 100) / 100;

    const kategorijeStats: Record<string, number> = {};
    for (const item of items) {
      const kat = item.kategorija || "OSTALO";
      kategorijeStats[kat] = (kategorijeStats[kat] || 0) + Number(item.iznos_ukupno || 0);
    }

    return NextResponse.json({
      ok: true,
      items,
      stats: {
        ukupnoIznos,
        poreskaUsteda10,
        brojRacuna: items.length,
        kategorijeStats,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      broj_racuna,
      datum_racuna,
      dobavljac,
      kategorija = "GORIVO",
      iznos_ukupno,
      iznos_osnovica = null,
      iznos_pdv = null,
      valuta = "BAM",
      svrha = "",
      status_pravdanja = "SPREMNO_ZA_KNJIGOVOĐU",
      godina_obracuna,
    } = body;

    if (!broj_racuna || !datum_racuna || !dobavljac || iznos_ukupno === undefined) {
      return NextResponse.json(
        { ok: false, error: "Broj računa, datum, dobavljač i iznos su obavezni." },
        { status: 400 }
      );
    }

    const parsedDate = String(datum_racuna).slice(0, 10);
    const yr = godina_obracuna ? Number(godina_obracuna) : Number(parsedDate.slice(0, 4)) || new Date().getFullYear();

    const res: any = await query(
      `
      INSERT INTO mali_racuni
        (broj_racuna, datum_racuna, dobavljac, kategorija, iznos_ukupno, iznos_osnovica, iznos_pdv, valuta, svrha, status_pravdanja, godina_obracuna)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(broj_racuna).trim(),
        parsedDate,
        String(dobavljac).trim(),
        kategorija,
        Number(iznos_ukupno),
        iznos_osnovica !== null ? Number(iznos_osnovica) : null,
        iznos_pdv !== null ? Number(iznos_pdv) : null,
        valuta,
        svrha ? String(svrha).trim() : null,
        status_pravdanja,
        yr,
      ]
    );

    return NextResponse.json({ ok: true, id: res.insertId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      broj_racuna,
      datum_racuna,
      dobavljac,
      kategorija,
      iznos_ukupno,
      iznos_osnovica,
      iznos_pdv,
      valuta,
      svrha,
      status_pravdanja,
      godina_obracuna,
    } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    const parsedDate = datum_racuna ? String(datum_racuna).slice(0, 10) : undefined;
    const yr = godina_obracuna ? Number(godina_obracuna) : parsedDate ? Number(parsedDate.slice(0, 4)) : undefined;

    await query(
      `
      UPDATE mali_racuni SET
        broj_racuna = COALESCE(?, broj_racuna),
        datum_racuna = COALESCE(?, datum_racuna),
        dobavljac = COALESCE(?, dobavljac),
        kategorija = COALESCE(?, kategorija),
        iznos_ukupno = COALESCE(?, iznos_ukupno),
        iznos_osnovica = COALESCE(?, iznos_osnovica),
        iznos_pdv = COALESCE(?, iznos_pdv),
        valuta = COALESCE(?, valuta),
        svrha = COALESCE(?, svrha),
        status_pravdanja = COALESCE(?, status_pravdanja),
        godina_obracuna = COALESCE(?, godina_obracuna)
      WHERE id = ?
      `,
      [
        broj_racuna ? String(broj_racuna).trim() : null,
        parsedDate || null,
        dobavljac ? String(dobavljac).trim() : null,
        kategorija || null,
        iznos_ukupno !== undefined ? Number(iznos_ukupno) : null,
        iznos_osnovica !== undefined ? (iznos_osnovica !== null ? Number(iznos_osnovica) : null) : null,
        iznos_pdv !== undefined ? (iznos_pdv !== null ? Number(iznos_pdv) : null) : null,
        valuta || null,
        svrha !== undefined ? (svrha ? String(svrha).trim() : "") : null,
        status_pravdanja || null,
        yr || null,
        id,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }
    await query(`DELETE FROM mali_racuni WHERE id = ?`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
