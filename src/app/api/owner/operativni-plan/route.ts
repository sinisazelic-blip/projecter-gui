import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function getFxRateToBAM(currency: string): number {
  const c = String(currency || "BAM").toUpperCase();
  if (c === "EUR") return 1.95583;
  if (c === "USD") return 1.80;
  return 1.0;
}

// Auto-sync recurring pretplate & krediti due within 7 days
async function syncDueObligations() {
  try {
    const now = new Date();
    const todayDay = now.getDate();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, "0");
    const yearMonth = `${curYear}-${curMonth}`;

    const [pretplate, krediti] = (await Promise.all([
      query(`SELECT * FROM owner_privatne_pretplate WHERE status = 'AKTIVAN'`),
      query(`SELECT * FROM owner_privatni_krediti WHERE status = 'AKTIVAN'`),
    ])) as [any[], any[]];

    if (Array.isArray(pretplate)) {
      for (const p of pretplate) {
        const dueDay = Number(p.dan_u_mjesecu) || 1;
        const diffDays = dueDay - todayDay;
        // Ako je dospijeće za 7 dana ili ranije u ovom mjesecu
        if (diffDays <= 7) {
          const isPaidThisMonth = p.zadnje_placeno && String(p.zadnje_placeno).startsWith(yearMonth);
          if (!isPaidThisMonth) {
            const tag = `[PRETP:${p.id}:${yearMonth}]`;
            const existing = (await query(
              `SELECT id FROM owner_plan_stavke WHERE napomena LIKE ? AND status <> 'OTKAZANO' LIMIT 1`,
              [`%${tag}%`]
            )) as any[];

            if (!existing || existing.length === 0) {
              const fx = getFxRateToBAM(p.valuta);
              const iznosBAM = Math.round(Number(p.iznos || 0) * fx * 100) / 100;
              const safeDay = Math.min(Math.max(1, dueDay), 28);
              const rokDatum = `${yearMonth}-${String(safeDay).padStart(2, "0")}`;
              await query(
                `INSERT INTO owner_plan_stavke (vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena)
                 VALUES ('RASHOD', 'PRETPLATA', ?, ?, 'BAM', ?, 'PLANIRANO', ?)`,
                [
                  `${p.naziv} (${p.iznos} ${p.valuta})`,
                  iznosBAM,
                  rokDatum,
                  `${tag} Mjesečna pretplata ${p.naziv}`,
                ]
              );
            }
          }
        }
      }
    }

    if (Array.isArray(krediti)) {
      for (const k of krediti) {
        const dueDay = Number(k.dan_u_mjesecu) || 20;
        const diffDays = dueDay - todayDay;
        if (diffDays <= 7) {
          const tag = `[KRED:${k.id}:${yearMonth}]`;
          const existing = (await query(
            `SELECT id FROM owner_plan_stavke WHERE napomena LIKE ? AND status <> 'OTKAZANO' LIMIT 1`,
            [`%${tag}%`]
          )) as any[];

          if (!existing || existing.length === 0) {
            const fx = getFxRateToBAM(k.valuta);
            const iznosBAM = Math.round(Number(k.iznos_rate || 0) * fx * 100) / 100;
            const safeDay = Math.min(Math.max(1, dueDay), 28);
            const rokDatum = `${yearMonth}-${String(safeDay).padStart(2, "0")}`;
            await query(
              `INSERT INTO owner_plan_stavke (vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena)
               VALUES ('RASHOD', 'KREDIT', ?, ?, 'BAM', ?, 'PLANIRANO', ?)`,
              [
                `Rata: ${k.naziv} ${k.banka ? `(${k.banka})` : ""}`.trim(),
                iznosBAM,
                rokDatum,
                `${tag} Rata kredita ${k.naziv}`,
              ]
            );
          }
        }
      }
    }
  } catch (syncErr) {
    console.error("Greška pri sinhronizaciji dospijeća:", syncErr);
  }
}

export async function GET() {
  try {
    await syncDueObligations();

    const [racuni, planStavke, potrazivanjaRows] = await Promise.all([
      query(`
        SELECT id, naziv, opis, tip, saldo, valuta, sort_order, updated_at
        FROM owner_racuni_stanja
        ORDER BY sort_order ASC, id ASC
      `),
      query(`
        SELECT id, vrsta, kategorija, naziv, iznos, valuta, DATE_FORMAT(rok_datum, '%Y-%m-%d') AS rok_datum, status, napomena, sort_order, created_at
        FROM owner_plan_stavke
        ORDER BY sort_order ASC, id ASC
      `),
      query(`
        SELECT 
          f.faktura_id,
          f.broj_fakture_puni AS broj_fakture,
          f.datum_izdavanja,
          k.naziv_klijenta AS klijent_naziv,
          f.iznos_ukupno_km AS iznos_sa_pdv,
          f.valuta
        FROM fakture f
        LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
        WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
          AND (f.status IS NULL OR f.status <> 'PLACENA')
        ORDER BY f.datum_izdavanja DESC
        LIMIT 15
      `).catch(() => []),
    ]);

    return NextResponse.json({
      ok: true,
      racuni: racuni || [],
      planStavke: planStavke || [],
      tafPotrazivanja: potrazivanjaRows || [],
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target } = body;

    if (target === "racun") {
      const { naziv, opis = "", tip = "PRIVATNI_RACUN", saldo = 0, valuta = "BAM" } = body;
      if (!naziv) {
        return NextResponse.json({ ok: false, error: "Naziv računa je obavezan." }, { status: 400 });
      }

      const res: any = await query(
        `INSERT INTO owner_racuni_stanja (naziv, opis, tip, saldo, valuta) VALUES (?, ?, ?, ?, ?)`,
        [naziv.trim(), opis.trim(), tip, Number(saldo) || 0, valuta]
      );
      return NextResponse.json({ ok: true, id: res.insertId });
    }

    // Standardna plan stavka
    const {
      vrsta = "RASHOD",
      kategorija = "OSTALO",
      naziv,
      iznos,
      valuta = "BAM",
      rok_datum,
      status = "PLANIRANO",
      napomena = "",
    } = body;

    if (!naziv || iznos === undefined || iznos === null) {
      return NextResponse.json({ ok: false, error: "Naziv i iznos su obavezni." }, { status: 400 });
    }

    const res: any = await query(
      `
      INSERT INTO owner_plan_stavke 
        (vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        vrsta,
        kategorija,
        naziv.trim(),
        Number(iznos) || 0,
        valuta,
        rok_datum || null,
        status,
        napomena || null,
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
    const { target, id } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      const { naziv, opis, tip, saldo, valuta } = body;
      await query(
        `
        UPDATE owner_racuni_stanja SET
          naziv = COALESCE(?, naziv),
          opis = COALESCE(?, opis),
          tip = COALESCE(?, tip),
          saldo = COALESCE(?, saldo),
          valuta = COALESCE(?, valuta)
        WHERE id = ?
      `,
        [
          naziv,
          opis,
          tip,
          saldo !== undefined ? Number(saldo) : null,
          valuta,
          id,
        ]
      );
      return NextResponse.json({ ok: true });
    }

    // Plan stavka
    const { vrsta, kategorija, naziv, iznos, valuta, rok_datum, status, napomena } = body;
    await query(
      `
      UPDATE owner_plan_stavke SET
        vrsta = COALESCE(?, vrsta),
        kategorija = COALESCE(?, kategorija),
        naziv = COALESCE(?, naziv),
        iznos = COALESCE(?, iznos),
        valuta = COALESCE(?, valuta),
        rok_datum = COALESCE(?, rok_datum),
        status = COALESCE(?, status),
        napomena = COALESCE(?, napomena)
      WHERE id = ?
    `,
      [
        vrsta,
        kategorija,
        naziv,
        iznos !== undefined ? Number(iznos) : null,
        valuta,
        rok_datum,
        status,
        napomena,
        id,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, id, action, value } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      if (action === "update_saldo") {
        await query(`UPDATE owner_racuni_stanja SET saldo = ? WHERE id = ?`, [Number(value) || 0, id]);
        return NextResponse.json({ ok: true });
      }
    }

    if (action === "toggle_status" || action === "mark_paid" || action === "set_status") {
      let nextStatus = "PLANIRANO";
      if (action === "set_status") {
        nextStatus = value;
      } else if (action === "mark_paid") {
        nextStatus = "REALIZOVANO";
      } else {
        // toggle_status
        const rows = (await query(`SELECT status FROM owner_plan_stavke WHERE id = ?`, [id])) as any[];
        const cur = rows?.[0]?.status || "PLANIRANO";
        if (cur === "PLANIRANO") nextStatus = "REALIZOVANO";
        else if (cur === "REALIZOVANO") nextStatus = "HOLD";
        else if (cur === "HOLD") nextStatus = "PLANIRANO";
      }

      await query(`UPDATE owner_plan_stavke SET status = ? WHERE id = ?`, [nextStatus, id]);

      if (nextStatus === "REALIZOVANO") {
        try {
          const itemRows = (await query(`SELECT * FROM owner_plan_stavke WHERE id = ?`, [id])) as any[];
          const it = itemRows?.[0];
          if (it?.napomena) {
            const pretpMatch = it.napomena.match(/\[PRETP:(\d+):/);
            if (pretpMatch) {
              const pretpId = Number(pretpMatch[1]);
              const today = new Date().toISOString().slice(0, 10);
              await query(`UPDATE owner_privatne_pretplate SET zadnje_placeno = ? WHERE id = ?`, [today, pretpId]);
            }
            const kredMatch = it.napomena.match(/\[KRED:(\d+):/);
            if (kredMatch) {
              const kredId = Number(kredMatch[1]);
              await query(`UPDATE owner_privatni_krediti SET uplaceno_rata = uplaceno_rata + 1 WHERE id = ?`, [kredId]);
            }
          }
        } catch (linkErr) {
          console.error("Greška pri ažuriranju pretplate/kredita:", linkErr);
        }
      }

      return NextResponse.json({ ok: true, status: nextStatus });
    }

    return NextResponse.json({ ok: false, error: "Nepoznata akcija." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const target = searchParams.get("target");

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID je obavezan." }, { status: 400 });
    }

    if (target === "racun") {
      await query(`DELETE FROM owner_racuni_stanja WHERE id = ?`, [Number(id)]);
    } else {
      await query(`DELETE FROM owner_plan_stavke WHERE id = ?`, [Number(id)]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
