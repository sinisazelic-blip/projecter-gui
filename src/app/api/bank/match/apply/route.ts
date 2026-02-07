import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickCol(cols: Set<string>, candidates: string[]) {
  for (const c of candidates) if (cols.has(c)) return c;
  return null;
}

// POST /api/bank/match/apply
// body: { batch_id: number, dry_run?: boolean, limit?: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = Number(body?.batch_id);
    const dry_run = body?.dry_run === true;
    const limit =
      body?.limit === undefined || body?.limit === null || body?.limit === ""
        ? null
        : Number(body?.limit);

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid batch_id" }, { status: 400 });
    }
    if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
      return NextResponse.json({ ok: false, error: "Invalid limit" }, { status: 400 });
    }

    const out = await withTransaction(async (conn: any) => {
      // 0) batch postoji?
      const [brows]: any = await conn.execute(
        `SELECT batch_id FROM bank_import_batch WHERE batch_id = ? LIMIT 1`,
        [batch_id]
      );
      if (!Array.isArray(brows) || brows.length === 0) {
        return { ok: false, error: "BATCH_NOT_FOUND" as const };
      }

      // 1) introspekcija kolona
      const [stColsRows]: any = await conn.execute(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bank_tx_staging'
        `
      );
      const [mColsRows]: any = await conn.execute(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bank_tx_match'
        `
      );

      const stCols = new Set<string>((stColsRows ?? []).map((r: any) => String(r.COLUMN_NAME)));
      const mCols = new Set<string>((mColsRows ?? []).map((r: any) => String(r.COLUMN_NAME)));

      const colTxId = pickCol(stCols, ["tx_id"]);
      const colBatchId = pickCol(stCols, ["batch_id"]);
      const colDesc = pickCol(stCols, ["description", "opis"]);
      const colCp = pickCol(stCols, ["counterparty", "partner", "primaoc"]);
      const colAmount = pickCol(stCols, ["amount", "iznos"]);
      const colAccountId = pickCol(stCols, ["account_id"]); // optional

      if (!colTxId || !colBatchId) {
        return { ok: false, error: "STAGING_SCHEMA_MISSING", debug: { colTxId, colBatchId } };
      }

      const colMatchTx = pickCol(mCols, ["tx_id"]);
      const colMatchProj = pickCol(mCols, ["projekat_id"]);
      const colMatchKat = pickCol(mCols, ["kategorija"]);
      const colMatchBy = pickCol(mCols, ["matched_by"]);
      const colMatchNar = pickCol(mCols, ["narucilac_id"]); // optional

      if (!colMatchTx || !colMatchProj || !colMatchKat || !colMatchBy) {
        return {
          ok: false,
          error: "MATCH_SCHEMA_MISSING",
          debug: { colMatchTx, colMatchProj, colMatchKat, colMatchBy, colMatchNar },
        };
      }

      // 2) aktivna pravila
      const [rules]: any = await conn.execute(
        `
        SELECT
          rule_id, priority,
          match_text, match_account, match_amount, match_is_fee,
          projekat_id, narucilac_id, kategorija
        FROM bank_tx_match_rule
        WHERE is_active = 1
        ORDER BY priority ASC, rule_id ASC
        `
      );
      const rulesList = Array.isArray(rules) ? rules : [];

      // 3) build WHERE za rule
      function buildRuleWhere(rule: any) {
        const w: string[] = [];
        const p: any[] = [];

        w.push(`t.${colBatchId} = ?`);
        p.push(batch_id);

        if (rule.match_text && (colDesc || colCp)) {
          const parts: string[] = [];
          if (colDesc) parts.push(`t.${colDesc} LIKE ?`);
          if (colCp) parts.push(`t.${colCp} LIKE ?`);
          w.push(`(${parts.join(" OR ")})`);
          if (colDesc) p.push(`%${rule.match_text}%`);
          if (colCp) p.push(`%${rule.match_text}%`);
        }

        if (rule.match_amount !== null && rule.match_amount !== undefined && rule.match_amount !== "") {
          if (colAmount) {
            w.push(`t.${colAmount} = ?`);
            p.push(rule.match_amount);
          }
        }

        if (rule.match_account && colAccountId) {
          const n = Number(rule.match_account);
          if (Number.isFinite(n)) {
            w.push(`t.${colAccountId} = ?`);
            p.push(n);
          }
        }

        if (rule.match_is_fee === 1 && (colDesc || colCp)) {
          const parts: string[] = [];
          if (colDesc) parts.push(`LOWER(t.${colDesc}) LIKE '%proviz%'`);
          if (colDesc) parts.push(`LOWER(t.${colDesc}) LIKE '%fee%'`);
          if (colCp) parts.push(`LOWER(t.${colCp}) LIKE '%bank%'`);
          w.push(`(${parts.join(" OR ")})`);
        }

        return { whereSql: w.join(" AND "), params: p };
      }

      const per_rule: any[] = [];
      let total_candidates = 0;
      let updated_rows = 0;
      let inserted_rows = 0;

      for (const rule of rulesList) {
        const { whereSql, params } = buildRuleWhere(rule);

        // Gate: ne diraj manual; dozvoli ako m nema ili je m.matched_by NULL/'rule'
        const gateSql = `(m.${colMatchTx} IS NULL OR m.${colMatchBy} IS NULL OR m.${colMatchBy} = 'rule')`;

        // candidates count
        const [cntRows]: any = await conn.execute(
          `
          SELECT COUNT(*) AS cnt
          FROM bank_tx_staging t
          LEFT JOIN bank_tx_match m ON m.${colMatchTx} = t.${colTxId}
          WHERE ${whereSql}
            AND ${gateSql}
          `,
          params
        );
        const candidates = Number(cntRows?.[0]?.cnt ?? 0);
        total_candidates += candidates;

        if (dry_run) {
          per_rule.push({ rule_id: rule.rule_id, priority: rule.priority, candidates, updated: 0, inserted: 0 });
          continue;
        }

        const out_projekat_id = rule.projekat_id ?? null;
        const out_kategorija = rule.kategorija ?? null;
        const out_narucilac_id = rule.narucilac_id ?? null;

        // ako nema output, preskoči
        if (out_projekat_id === null && out_kategorija === null && (colMatchNar ? out_narucilac_id === null : true)) {
          per_rule.push({ rule_id: rule.rule_id, priority: rule.priority, candidates, updated: 0, inserted: 0, skipped: "NO_OUTPUT" });
          continue;
        }

        const limitSql = limit ? `LIMIT ${Math.floor(limit)}` : "";

        // (A) UPDATE postojećih (matched_by NULL ili rule)
        const updateParams: any[] = [];
        updateParams.push(out_projekat_id, out_kategorija);
        if (colMatchNar) updateParams.push(out_narucilac_id);
        updateParams.push(...params);

        const [upd]: any = await conn.execute(
          `
          UPDATE bank_tx_match m
          JOIN bank_tx_staging t ON t.${colTxId} = m.${colMatchTx}
          SET
            m.${colMatchProj} = ?,
            m.${colMatchKat} = ?,
            ${colMatchNar ? `m.${colMatchNar} = ?,` : ""}
            m.${colMatchBy} = 'rule'
          WHERE ${whereSql}
            AND (m.${colMatchBy} IS NULL OR m.${colMatchBy} = 'rule')
          ${limitSql}
          `,
          updateParams
        );
        const updAff = Number(upd?.affectedRows ?? 0);
        updated_rows += updAff;

        // (B) INSERT novih (gdje match ne postoji)
        const insertCols: string[] = [colMatchTx, colMatchProj, colMatchKat, colMatchBy];
        const selectCols: string[] = [`t.${colTxId}`, `?`, `?`, `'rule'`];
        const insertParams: any[] = [out_projekat_id, out_kategorija];

        if (colMatchNar) {
          insertCols.push(colMatchNar);
          selectCols.push(`?`);
          insertParams.push(out_narucilac_id);
        }

        const [ins]: any = await conn.execute(
          `
          INSERT INTO bank_tx_match (${insertCols.join(", ")})
          SELECT ${selectCols.join(", ")}
          FROM bank_tx_staging t
          LEFT JOIN bank_tx_match m ON m.${colMatchTx} = t.${colTxId}
          WHERE ${whereSql}
            AND m.${colMatchTx} IS NULL
          ${limitSql}
          `,
          [...insertParams, ...params]
        );
        const insAff = Number(ins?.affectedRows ?? 0);
        inserted_rows += insAff;

        per_rule.push({
          rule_id: rule.rule_id,
          priority: rule.priority,
          candidates,
          updated: updAff,
          inserted: insAff,
        });
      }

      const [totMatchRows]: any = await conn.execute(
        `
        SELECT COUNT(*) AS cnt
        FROM bank_tx_match m
        JOIN bank_tx_staging t ON t.${colTxId} = m.${colMatchTx}
        WHERE t.${colBatchId} = ?
        `,
        [batch_id]
      );

      return {
        ok: true,
        batch_id,
        dry_run,
        rules_active: rulesList.length,
        total_candidates,
        updated_rows,
        inserted_rows,
        match_rows_for_batch: Number(totMatchRows?.[0]?.cnt ?? 0),
        per_rule,
        marker: "MATCH_APPLY_V2_SAFE",
      };
    });

    if (!out.ok && out.error === "BATCH_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "BATCH_NOT_FOUND" }, { status: 404 });
    }
    if (!out.ok) return NextResponse.json(out, { status: 400 });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
