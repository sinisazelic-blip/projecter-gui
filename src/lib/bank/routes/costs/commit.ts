import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickCol(cols: Set<string>, candidates: string[]) {
  for (const c of candidates) if (cols.has(c)) return c;
  return null;
}
function asStr(v: any) {
  return String(v ?? "").trim();
}
function clamp255(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 255 ? t.slice(0, 255) : t;
}

// handler za /api/bank/costs/commit
// body: { batch_id: number, include_positive?: boolean, tip_id_default?: number }
export async function handleBankCostsCommit(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = Number((body as any)?.batch_id);
    const include_positive = (body as any)?.include_positive === true;
    const tip_id_default = Number((body as any)?.tip_id_default ?? 1);

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid batch_id", marker: "COSTS_COMMIT_V2_STATUS" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(tip_id_default) || tip_id_default <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid tip_id_default", marker: "COSTS_COMMIT_V2_STATUS" },
        { status: 400 }
      );
    }

    const res = await withTransaction(async (conn: any) => {
      // Guard: mora biti posted (ili costed za idempotent)
      const [brows]: any = await conn.execute(
        `SELECT status FROM bank_import_batch WHERE batch_id = ? LIMIT 1`,
        [batch_id]
      );
      if (!Array.isArray(brows) || brows.length === 0) {
        return { ok: false, error: `Batch ${batch_id} ne postoji`, code: "BATCH_NOT_FOUND" };
      }
      const status = String(brows?.[0]?.status ?? "");
      if (status !== "posted" && status !== "costed") {
        return {
          ok: false,
          error: `Batch status mora biti posted (trenutno: ${status})`,
          code: "BAD_STATUS",
        };
      }

      // Kolone projektni_troskovi
      const [colRows]: any = await conn.execute(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'projektni_troskovi'
        `
      );
      if (!Array.isArray(colRows) || colRows.length === 0) {
        return { ok: false, error: "Tabela projektni_troskovi ne postoji u ovoj bazi." };
      }

      const cols = new Set<string>(colRows.map((r: any) => String(r.COLUMN_NAME)));
      const colProjekat = pickCol(cols, ["projekat_id"]);
      const colDatum = pickCol(cols, ["datum_troska", "datum", "datum_valute", "datum_knjizenja"]);
      const colIznos = pickCol(cols, ["iznos_km", "iznos", "iznos_bam", "iznos_valuta"]);
      const colOpis = pickCol(cols, ["opis", "napomena", "opis_troska", "opis_stavke", "naziv"]);
      const colKategorija = pickCol(cols, ["kategorija", "kategorija_txt", "kategorija_naziv"]);
      const colTipId = pickCol(cols, ["tip_id", "tip_troska_id", "vrsta_id"]);

      if (!colProjekat || !colDatum || !colIznos || !colOpis) {
        return {
          ok: false,
          error:
            "Ne mogu mapirati projektni_troskovi. Treba bar: projekat_id + datum + iznos(_km) + opis/napomena.",
          debug: { colProjekat, colDatum, colIznos, colOpis, colKategorija, colTipId },
        };
      }

      // Postings koji nisu linkovani i imaju projekat_id
      const [postings]: any = await conn.execute(
        `
        SELECT
          p.posting_id,
          p.tx_id,
          p.batch_id,
          p.account_id,
          p.value_date,
          p.amount,
          p.currency,
          p.projekat_id,
          p.kategorija,
          p.counterparty,
          p.description,
          p.matched_by
        FROM bank_tx_posting p
        LEFT JOIN bank_tx_cost_link l ON l.posting_id = p.posting_id
        WHERE p.batch_id = ?
          AND l.posting_id IS NULL
          AND p.projekat_id IS NOT NULL
          AND (${include_positive ? "1=1" : "p.amount < 0"})
        ORDER BY p.posting_id ASC
        `,
        [batch_id]
      );

      let inserted = 0;
      let skipped = 0;
      const errors: any[] = [];

      for (const p of postings) {
        try {
          const projekat_id = p.projekat_id;
          const datum = p.value_date ?? new Date();
          const iznos = Math.abs(Number(p.amount ?? 0));
          const opis = clamp255([asStr(p.counterparty), asStr(p.description)].filter(Boolean).join(" / "));
          const kategorija = asStr(p.kategorija) || null;

          const insertCols: string[] = [colProjekat, colDatum, colIznos, colOpis];
          const insertVals: any[] = [projekat_id, datum, iznos, opis];

          if (colTipId) {
            insertCols.push(colTipId);
            insertVals.push(tip_id_default);
          }
          if (colKategorija) {
            insertCols.push(colKategorija);
            insertVals.push(kategorija);
          }

          const sql = `INSERT INTO projektni_troskovi (${insertCols.join(", ")})
                       VALUES (${insertCols.map(() => "?").join(", ")})`;

          const [ins]: any = await conn.execute(sql, insertVals);
          const trosak_row_id = ins?.insertId ?? null;

          await conn.execute(
            `
            INSERT INTO bank_tx_cost_link
              (posting_id, tx_id, batch_id, account_id, projekat_id, trosak_row_id)
            VALUES
              (?, ?, ?, ?, ?, ?)
            `,
            [p.posting_id, p.tx_id, p.batch_id, p.account_id ?? null, projekat_id, trosak_row_id]
          );

          inserted += 1;
        } catch (e: any) {
          errors.push({ posting_id: p?.posting_id, error: e?.message ?? String(e) });
          skipped += 1;
        }
      }

      // status -> costed
      await conn.execute(
        `UPDATE bank_import_batch SET status = 'costed' WHERE batch_id = ?`,
        [batch_id]
      );

      return {
        ok: true,
        batch_id,
        scanned: Array.isArray(postings) ? postings.length : 0,
        inserted,
        skipped,
        errors,
        status: "costed",
        marker: "COSTS_COMMIT_V2_STATUS",
        mapping: { colProjekat, colDatum, colIznos, colOpis, colKategorija, colTipId, tip_id_default },
      };
    });

    if (!res.ok) return NextResponse.json({ ...res, marker: "COSTS_COMMIT_V2_STATUS" }, { status: 400 });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error", marker: "COSTS_COMMIT_V2_STATUS" },
      { status: 500 }
    );
  }
}
