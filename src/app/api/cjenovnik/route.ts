import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normCcy(v: any) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "BAM";
  return s.slice(0, 3);
}

function normText(v: any, max = 255) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : "";
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") ?? "").trim();
    const limit = asInt(searchParams.get("limit")) ?? 50;
    const picker = String(searchParams.get("picker") ?? "") === "1";

    const hasInoPrice = await hasColumn("cjenovnik_stavke", "cijena_ino_eur");

    // 1) SEARCH mode (stari picker – ostaje kompatibilno)
    if (q) {
      const like = `%${q}%`;

      const sql = hasInoPrice
        ? `
          SELECT
            stavka_id,
            naziv,
            jedinica,
            cijena_default,
            valuta_default,
            cijena_ino_eur,
            sort_order
          FROM cjenovnik_stavke
          WHERE active = 1
            AND (naziv LIKE ? OR jedinica LIKE ?)
          ORDER BY naziv ASC
          LIMIT ?
        `
        : `
          SELECT
            stavka_id,
            naziv,
            jedinica,
            cijena_default,
            valuta_default,
            NULL AS cijena_ino_eur,
            sort_order
          FROM cjenovnik_stavke
          WHERE active = 1
            AND (naziv LIKE ? OR jedinica LIKE ?)
          ORDER BY naziv ASC
          LIMIT ?
        `;

      const [rows]: any = await pool.query(sql, [like, like, Math.max(1, Math.min(limit, 100))]);
      return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
    }

    // 2) PICKER LIST mode (dropdown)
    if (picker) {
      const lim = Math.max(1, Math.min(limit, 1000));

      const sql = hasInoPrice
        ? `
          SELECT
            stavka_id,
            naziv,
            jedinica,
            cijena_default,
            valuta_default,
            cijena_ino_eur,
            sort_order
          FROM cjenovnik_stavke
          WHERE active = 1
          ORDER BY naziv ASC
          LIMIT ?
        `
        : `
          SELECT
            stavka_id,
            naziv,
            jedinica,
            cijena_default,
            valuta_default,
            NULL AS cijena_ino_eur,
            sort_order
          FROM cjenovnik_stavke
          WHERE active = 1
          ORDER BY naziv ASC
          LIMIT ?
        `;

      const [rows]: any = await pool.query(sql, [lim]);
      return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
    }

    // 3) LIST mode (Cjenovnik module)
    const sql = hasInoPrice
      ? `
        SELECT
          stavka_id,
          naziv,
          jedinica,
          cijena_default,
          valuta_default,
          cijena_ino_eur,
          sort_order,
          active,
          created_at,
          updated_at
        FROM cjenovnik_stavke
        ORDER BY naziv ASC
      `
      : `
        SELECT
          stavka_id,
          naziv,
          jedinica,
          cijena_default,
          valuta_default,
          NULL AS cijena_ino_eur,
          sort_order,
          active,
          created_at,
          updated_at
        FROM cjenovnik_stavke
        ORDER BY naziv ASC
      `;

    const [rows]: any = await pool.query(sql);
    return NextResponse.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const hasInoPrice = await hasColumn("cjenovnik_stavke", "cijena_ino_eur");

    let saved = 0;

    for (const it of items) {
      const stavka_id = asInt(it?.stavka_id);
      const naziv = normText(it?.naziv, 255);
      const jedinica = normText(it?.jedinica, 60);
      const cijena_default = asNum(it?.cijena_default);
      const valuta_default = normCcy(it?.valuta_default);
      const active = it?.active ? 1 : 0;

      const cijena_ino_eur = hasInoPrice ? asNum(it?.cijena_ino_eur) : null;

      if (!naziv) continue;
      if (!jedinica) continue;
      if (cijena_default === null) continue;

      if (stavka_id && stavka_id > 0) {
        if (hasInoPrice) {
          await pool.query(
            `
            UPDATE cjenovnik_stavke
            SET
              naziv = ?,
              jedinica = ?,
              cijena_default = ?,
              valuta_default = ?,
              cijena_ino_eur = ?,
              active = ?,
              updated_at = NOW()
            WHERE stavka_id = ?
            LIMIT 1
            `,
            [naziv, jedinica, cijena_default, valuta_default, cijena_ino_eur, active, stavka_id]
          );
        } else {
          await pool.query(
            `
            UPDATE cjenovnik_stavke
            SET
              naziv = ?,
              jedinica = ?,
              cijena_default = ?,
              valuta_default = ?,
              active = ?,
              updated_at = NOW()
            WHERE stavka_id = ?
            LIMIT 1
            `,
            [naziv, jedinica, cijena_default, valuta_default, active, stavka_id]
          );
        }

        saved += 1;
      } else {
        if (hasInoPrice) {
          const [res]: any = await pool.query(
            `
            INSERT INTO cjenovnik_stavke
              (naziv, jedinica, cijena_default, valuta_default, cijena_ino_eur, sort_order, active, created_at, updated_at)
            VALUES
              (?, ?, ?, ?, ?, 0, ?, NOW(), NOW())
            `,
            [naziv, jedinica, cijena_default, valuta_default, cijena_ino_eur, active]
          );

          const newId = res?.insertId ?? null;

          if (newId) {
            await pool.query(
              `
              UPDATE cjenovnik_stavke
              SET sort_order = ?
              WHERE stavka_id = ?
              LIMIT 1
              `,
              [newId, newId]
            );
          }
        } else {
          const [res]: any = await pool.query(
            `
            INSERT INTO cjenovnik_stavke
              (naziv, jedinica, cijena_default, valuta_default, sort_order, active, created_at, updated_at)
            VALUES
              (?, ?, ?, ?, 0, ?, NOW(), NOW())
            `,
            [naziv, jedinica, cijena_default, valuta_default, active]
          );

          const newId = res?.insertId ?? null;

          if (newId) {
            await pool.query(
              `
              UPDATE cjenovnik_stavke
              SET sort_order = ?
              WHERE stavka_id = ?
              LIMIT 1
              `,
              [newId, newId]
            );
          }
        }

        saved += 1;
      }
    }

    return NextResponse.json({ ok: true, saved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Greška" }, { status: 500 });
  }
}
