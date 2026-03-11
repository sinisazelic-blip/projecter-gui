import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const year = new Date().getFullYear();
    const yStart = `${year}-01-01`;
    const yEnd = `${year}-12-31`;

    // --- 1) Dugovanja prekoračena (projekt_dugovanja + fiksni ako view postoji) ---
    let overduePayables: { title: string; iznos_km: number; kasni_dana: number }[] = [];
    let overduePayablesTotal = 0;

    try {
      const dugRows = (await query(
        `
        SELECT
          d.dugovanje_id,
          d.opis,
          d.datum_dospijeca,
          d.iznos_km,
          COALESCE(v.paid_km, v.paid_sum_km, v.paid_sum, 0) AS paid_km
        FROM projekt_dugovanja d
        LEFT JOIN v_dugovanja_paid_sum v ON v.dugovanje_id = d.dugovanje_id
        WHERE COALESCE(d.datum_dospijeca, d.datum) < CURDATE()
        ORDER BY COALESCE(d.datum_dospijeca, d.datum) ASC
        LIMIT 50
        `,
      )) as any[];

      for (const r of dugRows || []) {
        const iznos = Number(r.iznos_km ?? r.iznos ?? 0) || 0;
        const paid = Number(r.paid_km ?? 0) || 0;
        const preostalo = iznos - paid;
        if (preostalo < 0.01) continue;
        const dueStr = (r.datum_dospijeca ?? r.datum) ? String(r.datum_dospijeca ?? r.datum).slice(0, 10) : null;
        const due = dueStr ? new Date(dueStr) : null;
        const kasni = due && !Number.isNaN(due.getTime())
          ? Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        const title = (r.opis || `Dugovanje #${r.dugovanje_id}`).toString().trim().slice(0, 50);
        overduePayables.push({ title, iznos_km: Math.round(preostalo * 100) / 100, kasni_dana: kasni });
        overduePayablesTotal += Math.round(preostalo * 100) / 100;
      }
    } catch {
      // tabela/view možda ne postoji
    }

    // Fiksni troškovi prekoračeni (vw_fiksni_troskovi_raspored ako postoji)
    try {
      const fiksniRows = (await query(
        `
        SELECT trosak_id, naziv_troska, due_date, datum_dospijeca, amount_km, iznos_km, status
        FROM vw_fiksni_troskovi_raspored
        WHERE (COALESCE(due_date, datum_dospijeca) < CURDATE())
          AND (status IS NULL OR status <> 'PLACENO')
        ORDER BY COALESCE(due_date, datum_dospijeca) ASC
        LIMIT 30
        `,
      )) as any[];
      for (const r of fiksniRows || []) {
        const iznos = Number(r.iznos_km ?? r.amount_km ?? 0) || 0;
        if (iznos < 0.01) continue;
        const dueStr = (r.due_date ?? r.datum_dospijeca) ? String(r.due_date ?? r.datum_dospijeca).slice(0, 10) : null;
        const due = dueStr ? new Date(dueStr) : null;
        const kasni = due && !Number.isNaN(due.getTime())
          ? Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        const title = (r.naziv_troska || `Fiksni #${r.trosak_id}`).toString().trim().slice(0, 50);
        overduePayables.push({ title, iznos_km: Math.round(iznos * 100) / 100, kasni_dana: kasni });
        overduePayablesTotal += Math.round(iznos * 100) / 100;
      }
    } catch {
      // view možda ne postoji
    }

    // --- 2) Potraživanja prekoračena (samo NENAPLAĆENE fakture, datum dospijeća prošao, jedna po fakturi) ---
    let overdueReceivables: { broj_fakture: string; radni_naziv: string; iznos_km: number; kasni_dana: number }[] = [];
    let overdueReceivablesTotal = 0;

    try {
      const recRows = (await query(
        `
        SELECT
          f.faktura_id,
          COALESCE(f.broj_fakture_puni, CONCAT(LPAD(f.broj_u_godini, 3, '0'), '/', f.godina)) AS broj_fakture,
          f.iznos_ukupno_km AS iznos,
          DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) AS datum_dospijeca,
          (SELECT p.radni_naziv
           FROM faktura_projekti fp2
           JOIN projekti p ON p.projekat_id = fp2.projekat_id
           WHERE fp2.faktura_id = f.faktura_id
           ORDER BY p.projekat_id ASC
           LIMIT 1) AS radni_naziv
        FROM fakture f
        LEFT JOIN klijenti kn ON kn.klijent_id = f.bill_to_klijent_id
        WHERE (f.fiskalni_status IS NULL OR f.fiskalni_status NOT IN ('PLACENA', 'DJELIMICNO', 'STORNIRAN', 'ZAMIJENJEN'))
          AND f.datum_izdavanja IS NOT NULL
          AND DATE(f.datum_izdavanja) >= '2000-01-01'
          AND DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) < CURDATE()
        ORDER BY DATE_ADD(f.datum_izdavanja, INTERVAL COALESCE(kn.rok_placanja_dana, 30) DAY) ASC
        LIMIT 50
        `,
      )) as any[];

      for (const r of recRows || []) {
        const iznos = Number(r.iznos ?? 0) || 0;
        if (iznos < 0.01) continue;
        const dueStr = r.datum_dospijeca ? String(r.datum_dospijeca).slice(0, 10) : null;
        const due = dueStr ? new Date(dueStr) : null;
        const kasni = due && !Number.isNaN(due.getTime())
          ? Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        overdueReceivables.push({
          broj_fakture: String(r.broj_fakture ?? "").slice(0, 20),
          radni_naziv: String(r.radni_naziv ?? "").slice(0, 40),
          iznos_km: Math.round(iznos * 100) / 100,
          kasni_dana: kasni,
        });
        overdueReceivablesTotal += Math.round(iznos * 100) / 100;
      }
    } catch {
      // tabela/faktura_projekti možda drugačija
    }

    // --- 3) Pregled finansija (tekuća godina): Fakturisano, Troškovi, Dobit ---
    let fakturisanoYtd = 0;
    let troskoviYtd = 0;
    try {
      const fRows = (await query(
        `SELECT COALESCE(SUM(iznos_ukupno_km), 0) AS s
         FROM fakture
         WHERE (fiskalni_status IS NULL OR fiskalni_status NOT IN ('STORNIRAN', 'ZAMIJENJEN'))
           AND datum_izdavanja >= ? AND datum_izdavanja <= ?`,
        [yStart, yEnd],
      )) as any[];
      fakturisanoYtd = Number(fRows?.[0]?.s ?? 0) || 0;
    } catch {
      //
    }
    try {
      const tRows = (await query(
        `SELECT COALESCE(SUM(iznos_km), 0) AS s
         FROM projektni_troskovi
         WHERE status <> 'STORNIRANO'
           AND DATE(datum_troska) >= ? AND DATE(datum_troska) <= ?`,
        [yStart, yEnd],
      )) as any[];
      troskoviYtd = Number(tRows?.[0]?.s ?? 0) || 0;
    } catch {
      //
    }
    const dobitYtd = Math.round((fakturisanoYtd - troskoviYtd) * 100) / 100;

    // --- 4) Projekti u fazi izrade (status 1–7): suma budžeta ---
    let budzetProjekata = 0;
    let brojProjekata = 0;
    try {
      const sumRows = (await query(
        `
        SELECT
          COUNT(*) AS cnt,
          COALESCE(SUM(COALESCE(vf.budzet_planirani, p.budzet_planirani, 0)), 0) AS budzet
        FROM projekti p
        LEFT JOIN vw_projekti_finansije vf ON vf.projekat_id = p.projekat_id
        WHERE p.status_id BETWEEN 1 AND 7
        `,
      )) as any[];
      brojProjekata = Number(sumRows?.[0]?.cnt ?? 0) || 0;
      budzetProjekata = Number(sumRows?.[0]?.budzet ?? 0) || 0;
    } catch {
      //
    }

    return NextResponse.json({
      ok: true,
      overduePayables: {
        items: overduePayables.slice(0, 15),
        total_km: Math.round(overduePayablesTotal * 100) / 100,
      },
      overdueReceivables: {
        items: overdueReceivables.slice(0, 15),
        total_km: Math.round(overdueReceivablesTotal * 100) / 100,
      },
      financeSummary: {
        year,
        fakturisano_km: Math.round(fakturisanoYtd * 100) / 100,
        troskovi_km: Math.round(troskoviYtd * 100) / 100,
        dobit_km: dobitYtd,
      },
      projectsInProgress: {
        broj_projekata: brojProjekata,
        budzet_ukupno_km: Math.round(budzetProjekata * 100) / 100,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
