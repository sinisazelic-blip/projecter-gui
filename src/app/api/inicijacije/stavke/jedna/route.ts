import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { assertDealEditableOrThrow } from "@/lib/projects/deal-edit-guard";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function normCcy(v: any) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  return (s || "BAM").slice(0, 3);
}

/**
 * FAZA 1 (MUST):
 * - touch inicijacije.updated_at
 * - revalidate Deal
 * - revalidate Projects (ako postoji projekat)
 */
async function touchDeal(inicijacija_id: number, projekat_id?: number) {
  await pool.query(
    `UPDATE inicijacije SET updated_at = NOW() WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id],
  );

  revalidatePath(`/inicijacije/${inicijacija_id}`);
  revalidatePath(`/inicijacije`);

  if (projekat_id && projekat_id > 0) {
    revalidatePath(`/projects/${projekat_id}`);
    revalidatePath(`/projects`);
  }
}

async function syncProjectBudgetFromDeal(inicijacija_id: number) {
  const [r1]: any = await pool.query(
    `SELECT projekat_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id],
  );
  const projekat_id =
    Array.isArray(r1) && r1.length ? Number(r1[0]?.projekat_id ?? 0) : 0;
  if (!projekat_id) return { didSync: false };

  const [insSnap]: any = await pool.query(
    `INSERT INTO projekat_budget_snapshots (projekat_id, inicijacija_id) VALUES (?, ?)`,
    [projekat_id, inicijacija_id],
  );
  const snapshot_id = Number(insSnap?.insertId ?? 0);
  if (!snapshot_id) return { didSync: false };

  const [dealItems]: any = await pool.query(
    `
    SELECT
      inicijacija_stavka_id,
      naziv_snapshot,
      kolicina,
      cijena_jedinicna,
      valuta,
      opis,
      line_total
    FROM inicijacija_stavke
    WHERE inicijacija_id = ?
    ORDER BY inicijacija_stavka_id ASC
    `,
    [inicijacija_id],
  );

  const items = Array.isArray(dealItems) ? dealItems : [];
  if (items.length === 0) {
    return { didSync: true, projekat_id, snapshot_id, count: 0 };
  }

  const placeholders: string[] = [];
  const values: any[] = [];

  for (const it of items) {
    placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    values.push(
      projekat_id,
      snapshot_id,
      inicijacija_id,
      Number(it.inicijacija_stavka_id ?? 0) || null,
      it.naziv_snapshot ?? "",
      it.opis ?? null,
      Number(it.kolicina ?? 0),
      Number(it.cijena_jedinicna ?? 0),
      normCcy(it.valuta),
      Number(it.line_total ?? 0),
    );
  }

  await pool.query(
    `
    INSERT INTO projekat_stavke
      (projekat_id, snapshot_id, inicijacija_id, inicijacija_stavka_id,
       naziv, opis, kolicina, cijena_jedinicna, valuta, line_total)
    VALUES
      ${placeholders.join(",")}
    `,
    values,
  );

  return { didSync: true, projekat_id, snapshot_id, count: items.length };
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = num(url.searchParams.get("id"));
    if (!id || id <= 0)
      return NextResponse.json(
        { ok: false, error: "Neispravan ID." },
        { status: 400 },
      );

    const body = await req.json().catch(() => ({}));

    const kolicina = num(body.kolicina);
    const cijena_jedinicna = num(body.cijena_jedinicna);

    const [rows]: any = await pool.query(
      `SELECT inicijacija_id, kolicina, cijena_jedinicna, valuta FROM inicijacija_stavke WHERE inicijacija_stavka_id = ? LIMIT 1`,
      [id],
    );
    const cur = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!cur)
      return NextResponse.json(
        { ok: false, error: "Stavka nije pronađena." },
        { status: 404 },
      );

    const inicijacija_id = Number(cur.inicijacija_id ?? 0);
    await assertDealEditableOrThrow(req, inicijacija_id);

    const newK = kolicina ?? Number(cur.kolicina ?? 1);
    const newC = cijena_jedinicna ?? Number(cur.cijena_jedinicna ?? 0);
    const newV = normCcy(cur.valuta ?? "BAM");

    const line_total = round2(Number(newK) * Number(newC));

    await pool.query(
      `
      UPDATE inicijacija_stavke
      SET kolicina = ?, cijena_jedinicna = ?, valuta = ?, line_total = ?
      WHERE inicijacija_stavka_id = ?
      `,
      [newK, newC, newV, line_total, id],
    );

    // ✅ AUTO-SYNC u projekat: novi snapshot (ako postoji projekat)
    let sync: any = { didSync: false };
    if (inicijacija_id > 0) {
      sync = await syncProjectBudgetFromDeal(inicijacija_id);
      await touchDeal(inicijacija_id, sync?.projekat_id);
    }

    return NextResponse.json({ ok: true, line_total, sync });
  } catch (e: any) {
    if (e?.status === 423) {
      return NextResponse.json(
        { ok: false, error: "Projekat je zaključan. Potreban je admin override." },
        { status: 423 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = num(url.searchParams.get("id"));
    if (!id || id <= 0)
      return NextResponse.json(
        { ok: false, error: "Neispravan ID." },
        { status: 400 },
      );

    const [r0]: any = await pool.query(
      `SELECT inicijacija_id FROM inicijacija_stavke WHERE inicijacija_stavka_id = ? LIMIT 1`,
      [id],
    );
    const inicijacija_id =
      Array.isArray(r0) && r0.length ? Number(r0[0]?.inicijacija_id ?? 0) : 0;
    if (inicijacija_id > 0) {
      await assertDealEditableOrThrow(req, inicijacija_id);
    }

    await pool.query(
      `DELETE FROM inicijacija_stavke WHERE inicijacija_stavka_id = ?`,
      [id],
    );

    // ✅ AUTO-SYNC + revalidate nakon brisanja (ako postoji projekat)
    let sync: any = { didSync: false };
    if (inicijacija_id > 0) {
      sync = await syncProjectBudgetFromDeal(inicijacija_id);
      await touchDeal(inicijacija_id, sync?.projekat_id);
    }

    return NextResponse.json({ ok: true, sync });
  } catch (e: any) {
    if (e?.status === 423) {
      return NextResponse.json(
        { ok: false, error: "Projekat je zaključan. Potreban je admin override." },
        { status: 423 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 },
    );
  }
}
