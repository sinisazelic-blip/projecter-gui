import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

function num(v: any) {
  if (v === null || v === undefined) return null;
  const s0 = String(v).toString();
  const s = s0.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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
      `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
      `,
      [table, column]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
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
    [inicijacija_id]
  );

  revalidatePath(`/inicijacije/${inicijacija_id}`);
  revalidatePath(`/inicijacije`);

  if (projekat_id && projekat_id > 0) {
    revalidatePath(`/projects/${projekat_id}`);
    revalidatePath(`/projects`);
  }
}

async function syncProjectBudgetFromDeal(inicijacija_id: number) {
  // 1) nađi projekat_id
  const [r1]: any = await pool.query(
    `SELECT projekat_id FROM inicijacije WHERE inicijacija_id = ? LIMIT 1`,
    [inicijacija_id]
  );
  const projekat_id = Array.isArray(r1) && r1.length ? Number(r1[0]?.projekat_id ?? 0) : 0;
  if (!projekat_id) return { didSync: false };

  // 2) napravi novi snapshot
  const [insSnap]: any = await pool.query(
    `INSERT INTO projekat_budget_snapshots (projekat_id, inicijacija_id) VALUES (?, ?)`,
    [projekat_id, inicijacija_id]
  );
  const snapshot_id = Number(insSnap?.insertId ?? 0);
  if (!snapshot_id) return { didSync: false };

  const hasStorno = await hasColumn("inicijacija_stavke", "stornirano");

  // 3) kopiraj trenutne deal stavke -> projekat_stavke
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
      ${hasStorno ? "AND stornirano = 0" : ""}
    ORDER BY inicijacija_stavka_id ASC
    `,
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
    `
    INSERT INTO projekat_stavke
      (projekat_id, snapshot_id, inicijacija_id, inicijacija_stavka_id,
       naziv, opis, kolicina, cijena_jedinicna, valuta, line_total)
    VALUES
      ${placeholders.join(",")}
    `,
    values
  );

  return { didSync: true, projekat_id, snapshot_id, count: items.length };
}

/**
 * MC: auto-odabir valute po klijentu:
 * - is_ino=1 => EUR (i cijena_ino_eur ako postoji)
 * - is_ino=0 => BAM (default)
 */
async function getDealCurrencyMode(inicijacija_id: number) {
  const [rows]: any = await pool.query(
    `
    SELECT COALESCE(k.is_ino, 0) AS is_ino
    FROM inicijacije i
    JOIN klijenti k ON k.klijent_id = i.narucilac_id
    WHERE i.inicijacija_id = ?
    LIMIT 1
    `,
    [inicijacija_id]
  );
  const is_ino = Array.isArray(rows) && rows.length ? Number(rows[0]?.is_ino ?? 0) : 0;
  return { is_ino: is_ino === 1 };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inicijacija_id = asInt(searchParams.get("inicijacija_id"));

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json({ ok: false, error: "Neispravan inicijacija_id." }, { status: 400 });
    }

    const hasStorno = await hasColumn("inicijacija_stavke", "stornirano");

    const [rows]: any = await pool.query(
      `
      SELECT
        inicijacija_stavka_id, inicijacija_id, stavka_id,
        naziv_snapshot, jedinica_snapshot,
        kolicina, cijena_jedinicna, valuta, opis, line_total,
        created_at, updated_at
      FROM inicijacija_stavke
      WHERE inicijacija_id = ?
        ${hasStorno ? "AND stornirano = 0" : ""}
      ORDER BY inicijacija_stavka_id ASC
      `,
      [inicijacija_id]
    );

    return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const inicijacija_id = asInt(body?.inicijacija_id);
    const stavka_id = asInt(body?.stavka_id);

    if (!inicijacija_id || inicijacija_id <= 0) {
      return NextResponse.json({ ok: false, error: "inicijacija_id je obavezan." }, { status: 400 });
    }
    if (!stavka_id || stavka_id <= 0) {
      return NextResponse.json({ ok: false, error: "stavka_id je obavezan." }, { status: 400 });
    }

    const hasInoPrice = await hasColumn("cjenovnik_stavke", "cijena_ino_eur");
    const { is_ino } = await getDealCurrencyMode(inicijacija_id);

    const [crows]: any = await pool.query(
      hasInoPrice
        ? `
          SELECT stavka_id, naziv, jedinica, cijena_default, valuta_default, cijena_ino_eur
          FROM cjenovnik_stavke
          WHERE stavka_id = ? AND active = 1
          LIMIT 1
        `
        : `
          SELECT stavka_id, naziv, jedinica, cijena_default, valuta_default, NULL AS cijena_ino_eur
          FROM cjenovnik_stavke
          WHERE stavka_id = ? AND active = 1
          LIMIT 1
        `,
      [stavka_id]
    );
    const c = Array.isArray(crows) && crows.length ? crows[0] : null;
    if (!c) {
      return NextResponse.json({ ok: false, error: "Stavka iz cjenovnika nije pronađena (ili nije aktivna)." }, { status: 404 });
    }

    const kolicina = num(body?.kolicina);
    const k = kolicina && kolicina > 0 ? kolicina : 1;

    const baseDefaultPrice =
      is_ino && Number(c.cijena_ino_eur ?? 0) > 0
        ? Number(c.cijena_ino_eur ?? 0)
        : Number(c.cijena_default ?? 0);

    const cijena_override = num(body?.cijena_jedinicna);
    const cijena =
      Number.isFinite(cijena_override as any) && (cijena_override as number) >= 0
        ? (cijena_override as number)
        : baseDefaultPrice;

    const valuta = is_ino ? "EUR" : normCcy(c.valuta_default);

    const opisRaw = body?.opis ?? null;
    const opis = opisRaw && String(opisRaw).trim() ? String(opisRaw).trim().slice(0, 500) : null;

    const line_total = round2(k * cijena);

    await pool.query(
      `
      INSERT INTO inicijacija_stavke
        (inicijacija_id, stavka_id, naziv_snapshot, jedinica_snapshot,
         kolicina, cijena_jedinicna, valuta, opis, line_total)
      VALUES
        (?, ?, ?, ?,
         ?, ?, ?, ?, ?)
      `,
      [inicijacija_id, c.stavka_id, c.naziv, c.jedinica, k, cijena, valuta, opis, line_total]
    );

    const sync = await syncProjectBudgetFromDeal(inicijacija_id);
    await touchDeal(inicijacija_id, sync?.projekat_id);

    return NextResponse.json({ ok: true, sync });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const inicijacija_stavka_id = asInt(body?.inicijacija_stavka_id);
    if (!inicijacija_stavka_id || inicijacija_stavka_id <= 0) {
      return NextResponse.json({ ok: false, error: "inicijacija_stavka_id je obavezan." }, { status: 400 });
    }

    const [r0]: any = await pool.query(
      `SELECT inicijacija_id FROM inicijacija_stavke WHERE inicijacija_stavka_id = ? LIMIT 1`,
      [inicijacija_stavka_id]
    );
    const inicijacija_id = Array.isArray(r0) && r0.length ? Number(r0[0]?.inicijacija_id ?? 0) : 0;
    if (!inicijacija_id) {
      return NextResponse.json({ ok: false, error: "Stavka nije pronađena." }, { status: 404 });
    }

    const k = num(body?.kolicina);
    const cij = num(body?.cijena_jedinicna);
    if (k === null || k <= 0) return NextResponse.json({ ok: false, error: "Količina mora biti broj > 0." }, { status: 400 });
    if (cij === null || cij < 0) return NextResponse.json({ ok: false, error: "Cijena mora biti broj ≥ 0." }, { status: 400 });

    const opisRaw = body?.opis ?? null;
    const opis = opisRaw && String(opisRaw).trim() ? String(opisRaw).trim().slice(0, 500) : null;

    const hasInoPrice = await hasColumn("cjenovnik_stavke", "cijena_ino_eur");
    const { is_ino } = await getDealCurrencyMode(inicijacija_id);

    const newStavkaId = asInt(body?.stavka_id);

    if (newStavkaId && newStavkaId > 0) {
      const [crows]: any = await pool.query(
        hasInoPrice
          ? `
            SELECT stavka_id, naziv, jedinica, valuta_default, cijena_ino_eur
            FROM cjenovnik_stavke
            WHERE stavka_id = ? AND active = 1
            LIMIT 1
          `
          : `
            SELECT stavka_id, naziv, jedinica, valuta_default, NULL AS cijena_ino_eur
            FROM cjenovnik_stavke
            WHERE stavka_id = ? AND active = 1
            LIMIT 1
          `,
        [newStavkaId]
      );
      const c = Array.isArray(crows) && crows.length ? crows[0] : null;
      if (!c) {
        return NextResponse.json({ ok: false, error: "Nova stavka iz cjenovnika nije pronađena (ili nije aktivna)." }, { status: 404 });
      }

      const valuta = is_ino ? "EUR" : normCcy(c.valuta_default);
      const line_total = round2(k * cij);

      await pool.query(
        `
        UPDATE inicijacija_stavke
        SET
          stavka_id = ?,
          naziv_snapshot = ?,
          jedinica_snapshot = ?,
          kolicina = ?,
          cijena_jedinicna = ?,
          valuta = ?,
          opis = ?,
          line_total = ?
        WHERE inicijacija_stavka_id = ?
        LIMIT 1
        `,
        [c.stavka_id, c.naziv, c.jedinica, k, cij, valuta, opis, line_total, inicijacija_stavka_id]
      );
    } else {
      const [r1]: any = await pool.query(
        `SELECT valuta FROM inicijacija_stavke WHERE inicijacija_stavka_id = ? LIMIT 1`,
        [inicijacija_stavka_id]
      );
      const valuta = Array.isArray(r1) && r1.length ? normCcy(r1[0]?.valuta) : "BAM";
      const line_total = round2(k * cij);

      await pool.query(
        `
        UPDATE inicijacija_stavke
        SET
          kolicina = ?,
          cijena_jedinicna = ?,
          opis = ?,
          line_total = ?,
          valuta = ?
        WHERE inicijacija_stavka_id = ?
        LIMIT 1
        `,
        [k, cij, opis, line_total, valuta, inicijacija_stavka_id]
      );
    }

    const sync = await syncProjectBudgetFromDeal(inicijacija_id);
    await touchDeal(inicijacija_id, sync?.projekat_id);

    return NextResponse.json({ ok: true, sync });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}

/**
 * STORNO (bez brisanja):
 * PATCH { inicijacija_stavka_id, stornirano?: 1|0 }
 * Default: stornirano=1
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inicijacija_stavka_id = asInt(body?.inicijacija_stavka_id);
    const st = asInt(body?.stornirano);
    const stornirano = st === 0 ? 0 : 1;

    if (!inicijacija_stavka_id || inicijacija_stavka_id <= 0) {
      return NextResponse.json({ ok: false, error: "inicijacija_stavka_id je obavezan." }, { status: 400 });
    }

    const hasStorno = await hasColumn("inicijacija_stavke", "stornirano");
    if (!hasStorno) {
      return NextResponse.json({ ok: false, error: "Kolona stornirano ne postoji (pokreni ALTER TABLE)." }, { status: 400 });
    }

    const [r0]: any = await pool.query(
      `SELECT inicijacija_id FROM inicijacija_stavke WHERE inicijacija_stavka_id = ? LIMIT 1`,
      [inicijacija_stavka_id]
    );
    const inicijacija_id = Array.isArray(r0) && r0.length ? Number(r0[0]?.inicijacija_id ?? 0) : 0;
    if (!inicijacija_id) {
      return NextResponse.json({ ok: false, error: "Stavka nije pronađena." }, { status: 404 });
    }

    await pool.query(
      `
      UPDATE inicijacija_stavke
      SET stornirano = ?, updated_at = NOW()
      WHERE inicijacija_stavka_id = ?
      LIMIT 1
      `,
      [stornirano, inicijacija_stavka_id]
    );

    const sync = await syncProjectBudgetFromDeal(inicijacija_id);
    await touchDeal(inicijacija_id, sync?.projekat_id);

    return NextResponse.json({ ok: true, stornirano, sync });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}
