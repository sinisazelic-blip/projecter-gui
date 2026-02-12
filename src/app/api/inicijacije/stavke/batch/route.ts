import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function num(v: any) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function normCcy(v: any) {
  const s = String(v ?? "").trim().toUpperCase();
  return (s || "BAM").slice(0, 3);
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       LIMIT 1`,
      [table, column]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function getDealCurrencyMode(inicijacija_id: number) {
  const [rows]: any = await pool.query(
    `SELECT COALESCE(k.is_ino, 0) AS is_ino
     FROM inicijacije i
     JOIN klijenti k ON k.klijent_id = i.narucilac_id
     WHERE i.inicijacija_id = ?
     LIMIT 1`,
    [inicijacija_id]
  );
  const is_ino = Array.isArray(rows) && rows.length ? Number(rows[0]?.is_ino ?? 0) : 0;
  return { is_ino: is_ino === 1 };
}

async function syncProjectBudgetFromDeal(inicijacija_id: number) {
  const [r1]: any = await pool.query(
    `SELECT projekat_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id]
  );
  const projekat_id = Array.isArray(r1) && r1.length ? Number(r1[0]?.projekat_id ?? 0) : 0;
  if (!projekat_id) return { didSync: false };

  const [insSnap]: any = await pool.query(
    `INSERT INTO projekat_budget_snapshots (projekat_id, inicijacija_id) VALUES (?, ?)`,
    [projekat_id, inicijacija_id]
  );
  const snapshot_id = Number(insSnap?.insertId ?? 0);
  if (!snapshot_id) return { didSync: false };

  const hasStorno = await hasColumn("inicijacija_stavke", "stornirano");

  const [dealItems]: any = await pool.query(
    `SELECT inicijacija_stavka_id, naziv_snapshot, kolicina, cijena_jedinicna, valuta, opis, line_total
     FROM inicijacija_stavke
     WHERE inicijacija_id = ? ${hasStorno ? "AND stornirano = 0" : ""}
     ORDER BY inicijacija_stavka_id ASC`,
    [inicijacija_id]
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
      Number(it.line_total ?? 0)
    );
  }

  await pool.query(
    `INSERT INTO projekat_stavke
       (projekat_id, snapshot_id, inicijacija_id, inicijacija_stavka_id,
        naziv, opis, kolicina, cijena_jedinicna, valuta, line_total)
     VALUES ${placeholders.join(",")}`,
    values
  );

  return { didSync: true, projekat_id, snapshot_id, count: items.length };
}

/**
 * POST /api/inicijacije/stavke/batch
 * Body: { inicijacija_id, items: [{ stavka_id, naziv, jedinica, kolicina, cijena_jedinicna, valuta }] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inicijacija_id = asInt(body?.inicijacija_id);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "inicijacija_id je obavezan." },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const { is_ino } = await getDealCurrencyMode(inicijacija_id);
    const hasInoPrice = await hasColumn("cjenovnik_stavke", "cijena_ino_eur");

    for (const it of items) {
      const stavka_id = asInt(it.stavka_id);
      const k = num(it.kolicina) ?? 1;
      let cijena = num(it.cijena_jedinicna);
      let valuta = normCcy(it.valuta);
      const naziv = String(it.naziv ?? "").trim() || "—";
      const jedinica = String(it.jedinica ?? "").trim() || "KOM";

      if (!stavka_id || stavka_id <= 0) continue;
      if (k <= 0) continue;

      if (cijena === null || cijena === undefined) {
        const [crows]: any = await pool.query(
          hasInoPrice
            ? `SELECT cijena_default, valuta_default, cijena_ino_eur FROM cjenovnik_stavke WHERE stavka_id = ? AND active = 1 LIMIT 1`
            : `SELECT cijena_default, valuta_default, NULL AS cijena_ino_eur FROM cjenovnik_stavke WHERE stavka_id = ? AND active = 1 LIMIT 1`,
          [stavka_id]
        );
        const c = Array.isArray(crows) && crows.length ? crows[0] : null;
        if (c) {
          if (is_ino && Number(c.cijena_ino_eur ?? 0) > 0) {
            cijena = Number(c.cijena_ino_eur);
            valuta = "EUR";
          } else {
            cijena = Number(c.cijena_default ?? 0);
            valuta = normCcy(c.valuta_default);
          }
        } else {
          cijena = 0;
        }
      }

      const line_total = round2(k * (cijena ?? 0));

      await pool.query(
        `INSERT INTO inicijacija_stavke
           (inicijacija_id, stavka_id, naziv_snapshot, jedinica_snapshot,
            kolicina, cijena_jedinicna, valuta, opis, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [inicijacija_id, stavka_id, naziv, jedinica, k, cijena, valuta, line_total]
      );
    }

    const sync = await syncProjectBudgetFromDeal(inicijacija_id);
    await pool.query(
      `UPDATE inicijacije SET updated_at = NOW() WHERE inicijacija_id = ? LIMIT 1`,
      [inicijacija_id]
    );

    revalidatePath(`/inicijacije/${inicijacija_id}`);
    revalidatePath("/inicijacije");

    return NextResponse.json({ ok: true, count: items.length, sync });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška" },
      { status: 500 }
    );
  }
}
