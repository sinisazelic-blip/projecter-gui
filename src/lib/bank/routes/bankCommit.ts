import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { findFakturaFromText } from "@/lib/bank/matchInvoiceFromText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDigits(input: string): string {
  return String(input || "").replace(/\D+/g, "");
}

function normalizeText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// handler za /api/bank/commit
// body: { batch_id: number }
export async function handleBankCommit(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const batch_id = Number((body as any)?.batch_id);

    if (!Number.isFinite(batch_id) || batch_id <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid batch_id", marker: "COMMIT_V2_UPSERT" },
        { status: 400 },
      );
    }

    const result = await withTransaction(async (conn: any) => {
      const ownerPrivateAccountRaw =
        process.env.FLUXA_OWNER_PRIVATE_ACCOUNT?.trim() || "";
      const ownerPrivateAccountDigits = normalizeDigits(ownerPrivateAccountRaw);
      const ownerProjectIdRaw = Number(process.env.FLUXA_OWNER_PROJECT_ID ?? 1);
      const ownerProjectId =
        Number.isFinite(ownerProjectIdRaw) && ownerProjectIdRaw > 0
          ? ownerProjectIdRaw
          : 1;

      // 0) provjera batch + account_id
      const [brows]: any = await conn.execute(
        `SELECT batch_id, account_id FROM bank_import_batch WHERE batch_id = ? LIMIT 1`,
        [batch_id],
      );

      if (!Array.isArray(brows) || brows.length === 0) {
        return {
          ok: false,
          error: `Batch ${batch_id} ne postoji`,
          code: "BATCH_NOT_FOUND",
        };
      }

      const account_id = brows[0]?.account_id ?? null;

      // 1) unmatched provjera
      const [unmRows]: any = await conn.execute(
        `
        SELECT COUNT(*) AS cnt
        FROM bank_tx_staging t
        LEFT JOIN bank_tx_match m ON m.tx_id = t.tx_id
        WHERE t.batch_id = ?
          AND m.tx_id IS NULL
        `,
        [batch_id],
      );

      const unmatched_cnt = Number(unmRows?.[0]?.cnt ?? 0);
      if (unmatched_cnt > 0) {
        return {
          ok: false,
          error: `Batch ima unmatched stavke: ${unmatched_cnt}`,
          code: "HAS_UNMATCHED",
        };
      }

      // 2) UPSERT: insert ili update po tx_id (UNIQUE na bank_tx_posting.tx_id)
      const [up]: any = await conn.execute(
        `
        INSERT INTO bank_tx_posting
          (tx_id, batch_id, account_id, value_date, amount, currency,
           projekat_id, kategorija, counterparty, description, matched_by, rule_id)
        SELECT
          t.tx_id,
          t.batch_id,
          ? AS account_id,
          COALESCE(t.value_date, CURDATE()) AS value_date,
          t.amount,
          COALESCE(t.currency, 'BAM') AS currency,
          m.projekat_id,
          m.kategorija,
          t.counterparty,
          LEFT(COALESCE(t.description, ''), 255) AS description,
          m.matched_by,
          NULL AS rule_id
        FROM bank_tx_staging t
        JOIN bank_tx_match m ON m.tx_id = t.tx_id
        WHERE t.batch_id = ?
        ON DUPLICATE KEY UPDATE
          batch_id     = VALUES(batch_id),
          account_id   = VALUES(account_id),
          value_date   = VALUES(value_date),
          amount       = VALUES(amount),
          currency     = VALUES(currency),
          projekat_id  = VALUES(projekat_id),
          kategorija   = VALUES(kategorija),
          counterparty = VALUES(counterparty),
          description  = VALUES(description),
          matched_by   = VALUES(matched_by),
          rule_id      = VALUES(rule_id)
        `,
        [account_id, batch_id],
      );

      const affected_rows = Number(up?.affectedRows ?? 0);

      // 3) status -> posted
      await conn.execute(
        `UPDATE bank_import_batch SET status = 'posted' WHERE batch_id = ?`,
        [batch_id],
      );

      // 4) Auto-uparivanje uplata na fakture: iz teksta (poziv na broj ili broj fakture 001/2026)
      let matched_invoices = 0;
      let matched_owner_transfers = 0;
      let owner_cash_in_added = 0;
      let matched_conversions = 0;
      try {
        const [postings]: any = await conn.execute(
          `
          SELECT
            p.posting_id,
            p.description,
            p.amount,
            p.value_date,
            p.counterparty,
            t.reference AS staging_reference,
            t.description AS staging_description,
            t.full_description AS staging_full_description
          FROM bank_tx_posting p
          LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
          LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = p.posting_id AND l.aktivan = 1
          WHERE p.batch_id = ? AND p.amount > 0 AND l.link_id IS NULL
          `,
          [batch_id],
        );
        const list = Array.isArray(postings) ? postings : [];
        for (const row of list) {
          const textParts = [
            row?.staging_reference,
            row?.staging_description,
            row?.staging_full_description,
            row?.description,
            row?.counterparty,
          ]
            .map((x) => String(x ?? "").trim())
            .filter(Boolean);
          const haystack = textParts.join("\n");
          const amount = Number(row?.amount);
          const valueDate = row?.value_date;
          const postingId = row?.posting_id;
          if (!Number.isFinite(amount) || amount <= 0 || !postingId) continue;

          const fakturaMatch = await findFakturaFromText(conn, haystack, null);
          if (!fakturaMatch || fakturaMatch.projekat_id <= 0) continue;

          const datum = valueDate ? String(valueDate).slice(0, 10) : null;
          if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

          const opisPrihoda = (
            String(row?.description ?? "").trim() ||
            haystack ||
            "Uplata po izvodu"
          ).slice(0, 255);

          const amountKm = Math.round(amount * 100) / 100;
          let prihodId: number | null = null;
          try {
            const [ins]: any = await conn.execute(
              `INSERT INTO projektni_prihodi (projekat_id, faktura_id, datum_prihoda, iznos_km, opis)
               VALUES (?, ?, ?, ?, ?)`,
              [fakturaMatch.projekat_id, fakturaMatch.faktura_id, datum, amountKm, opisPrihoda],
            );
            prihodId = ins?.insertId ?? null;
          } catch {
            try {
              const [ins2]: any = await conn.execute(
                `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis) VALUES (?, ?, ?, ?)`,
                [fakturaMatch.projekat_id, datum, amountKm, opisPrihoda || "Uplata po izvodu"],
              );
              prihodId = ins2?.insertId ?? null;
            } catch {
              continue;
            }
          }
          if (!prihodId) continue;

          await conn.execute(
            `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at) VALUES (?, ?, ?, 1, NOW())`,
            [postingId, prihodId, amountKm],
          );
          await conn.execute(
            `UPDATE fakture SET fiskalni_status = 'PLACENA' WHERE faktura_id = ?`,
            [fakturaMatch.faktura_id],
          );
          matched_invoices += 1;
        }

        // 5) Auto-link za prenos vlasnika na privatni račun:
        // Ako je u opisu "prenos" (ili "posudba vlasnika") i prepoznat privatni broj računa,
        // ulazna transakcija se automatski evidentira kao projektni_prihodi.
        if (ownerPrivateAccountDigits) {
          const [ownerCandidates]: any = await conn.execute(
            `
            SELECT
              p.posting_id,
              p.amount,
              p.value_date,
              p.counterparty,
              p.description,
              t.reference AS staging_reference,
              t.description AS staging_description,
              t.full_description AS staging_full_description
            FROM bank_tx_posting p
            LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
            LEFT JOIN bank_tx_posting_prihod_link l ON l.posting_id = p.posting_id AND l.aktivan = 1
            LEFT JOIN bank_tx_posting_placanje_link lp ON lp.posting_id = p.posting_id AND lp.aktivan = 1
            WHERE p.batch_id = ? AND p.amount <> 0 AND l.link_id IS NULL AND lp.link_id IS NULL
            `,
            [batch_id],
          );

          const ownerList = Array.isArray(ownerCandidates) ? ownerCandidates : [];
          for (const row of ownerList) {
            const postingId = Number(row?.posting_id);
            const amount = Number(row?.amount);
            if (!Number.isFinite(postingId) || postingId <= 0) continue;
            if (!Number.isFinite(amount) || amount <= 0) continue;

            const textParts = [
              row?.counterparty,
              row?.description,
              row?.staging_reference,
              row?.staging_description,
              row?.staging_full_description,
            ]
              .map((x) => String(x ?? "").trim())
              .filter(Boolean);
            const haystackRaw = textParts.join(" ");
            const haystackNorm = normalizeText(haystackRaw);
            const haystackDigits = normalizeDigits(haystackRaw);

            const hasOwnerAccount = haystackDigits.includes(ownerPrivateAccountDigits);
            const hasTransferKeyword =
              haystackNorm.includes("prenos") ||
              haystackNorm.includes("posudba vlasnika") ||
              haystackNorm.includes("uplata vlasnika");

            if (!hasOwnerAccount || !hasTransferKeyword) continue;

            const datum = row?.value_date ? String(row.value_date).slice(0, 10) : null;
            if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

            const amountKm = Math.round(Math.abs(amount) * 100) / 100;

            // Vlasnički prenos na privatni račun = gotovina dostupna za blagajnu.
            // Upisujemo kao IN u blagajna_stavke (idempotentno po posting_id).
            const cashMarker = `owner_transfer_posting:${postingId}`;
            const [cashExists]: any = await conn.execute(
              `SELECT id FROM blagajna_stavke
               WHERE transaction_details = ?
               LIMIT 1`,
              [cashMarker],
            );
            if (!Array.isArray(cashExists) || cashExists.length === 0) {
              await conn.execute(
                `INSERT INTO blagajna_stavke
                  (datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id, transaction_details, status)
                 VALUES (?, ?, ?, 'IN', ?, ?, NULL, NULL, ?, 'AKTIVAN')`,
                [
                  datum,
                  amountKm,
                  "KM",
                  "Automatski unos iz izvoda: prenos na privatni račun (keš).",
                  ownerProjectId,
                  cashMarker,
                ],
              );
              owner_cash_in_added += 1;
            }

            // Ako je incoming (uplata vlasnika), zadržavamo postojeće ponašanje:
            // evidentiramo i kao prihod projekta vlasnika + link na posting.
            if (amount > 0) {
              const opisPrihoda = `Prenos vlasnika (auto) [posting ${postingId}]`.slice(
                0,
                255,
              );

              const [insOwner]: any = await conn.execute(
                `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis)
                 VALUES (?, ?, ?, ?)`,
                [ownerProjectId, datum, amountKm, opisPrihoda],
              );
              const prihodId = insOwner?.insertId ?? null;
              if (prihodId) {
                await conn.execute(
                  `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at)
                   VALUES (?, ?, ?, 1, NOW())`,
                  [postingId, prihodId, amountKm],
                );
              }
            }
            matched_owner_transfers += 1;
          }
        }
      } catch (autoMatchErr: any) {
        console.warn("[bankCommit] auto-match invoices:", autoMatchErr?.message);
      }

      // 6) Auto-link konverzija EUR->KM (npr. "EXCH KONVERZIJA OPERATIVNI TECAJ ...")
      // Neutralno knjiženje: označi posting kao obrađen bez duplog prihoda/troška.
      try {
        const [convRows]: any = await conn.execute(
          `
          SELECT
            p.posting_id,
            p.amount,
            p.value_date,
            p.description,
            p.counterparty,
            t.description AS staging_description,
            t.full_description AS staging_full_description
          FROM bank_tx_posting p
          LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
          LEFT JOIN bank_tx_posting_prihod_link li ON li.posting_id = p.posting_id AND li.aktivan = 1
          LEFT JOIN bank_tx_posting_placanje_link lp ON lp.posting_id = p.posting_id AND lp.aktivan = 1
          WHERE p.batch_id = ?
            AND p.amount <> 0
            AND li.link_id IS NULL
            AND lp.link_id IS NULL
          `,
          [batch_id],
        );
        const list = Array.isArray(convRows) ? convRows : [];
        for (const row of list) {
          const postingId = Number(row?.posting_id);
          const amount = Number(row?.amount);
          if (!Number.isFinite(postingId) || postingId <= 0) continue;
          if (!Number.isFinite(amount) || amount === 0) continue;

          const text = normalizeText(
            [
              row?.description,
              row?.counterparty,
              row?.staging_description,
              row?.staging_full_description,
            ]
              .map((x) => String(x ?? "").trim())
              .filter(Boolean)
              .join(" "),
          );
          if (!text.includes("exch konverzija") || !text.includes("tecaj")) continue;

          const datum = row?.value_date ? String(row.value_date).slice(0, 10) : null;
          if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;
          const amountAbs = Math.round(Math.abs(amount) * 100) / 100;
          if (!(amountAbs > 0)) continue;

          if (amount > 0) {
            let insPrihod: any = null;
            try {
              const [insA]: any = await conn.execute(
                `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis)
                 VALUES (?, ?, 0, ?)`,
                [ownerProjectId, datum, `Automatska konverzija valute [posting ${postingId}]`],
              );
              insPrihod = insA;
            } catch {
              const [insB]: any = await conn.execute(
                `INSERT INTO projektni_prihodi (projekat_id, datum, iznos_km, opis)
                 VALUES (?, ?, 0, ?)`,
                [ownerProjectId, datum, `Automatska konverzija valute [posting ${postingId}]`],
              );
              insPrihod = insB;
            }
            const prihodId = insPrihod?.insertId ?? null;
            if (!prihodId) continue;
            await conn.execute(
              `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan, created_at)
               VALUES (?, ?, ?, 1, NOW())`,
              [postingId, prihodId, amountAbs],
            );
          } else {
            const [insPay]: any = await conn.execute(
              `INSERT INTO placanja
                (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
               VALUES
                (?, ?, 'BAM', 1.000000, 0, 'BANK_KONVERZIJA', ?, ?)`,
              [
                datum,
                amountAbs,
                `konverzija:posting_id=${postingId}`,
                `Automatska konverzija valute [posting ${postingId}]`,
              ],
            );
            const placanjeId = insPay?.insertId ?? null;
            if (!placanjeId) continue;
            await conn.execute(
              `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
               VALUES (?, ?, ?, 1)`,
              [postingId, placanjeId, amountAbs],
            );
          }

          await conn.execute(
            `UPDATE bank_tx_posting SET kategorija = 'konverzija' WHERE posting_id = ?`,
            [postingId],
          );
          matched_conversions += 1;
        }
      } catch (convErr: any) {
        console.warn("[bankCommit] auto-link conversions:", convErr?.message);
      }

      return {
        ok: true,
        batch_id,
        account_id,
        affected_rows,
        matched_invoices,
        matched_owner_transfers,
        owner_cash_in_added,
        matched_conversions,
        status: "posted",
        marker: "COMMIT_V2_UPSERT",
      };
    });

    if (!result.ok)
      return NextResponse.json(
        { ...result, marker: "COMMIT_V2_UPSERT" },
        { status: 400 },
      );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Server error",
        marker: "COMMIT_V2_UPSERT",
      },
      { status: 500 },
    );
  }
}
