import { query } from "@/lib/db";

type CoreFaza = "draft" | "planned" | "active" | "closed" | null;

type CloseCheck = {
  projekat_id: number;
  core_faza: CoreFaza;
  status_id: number;
  summary: {
    broj_troskova: number;
    ukupno_km: number;
    zadnji_trosak: string | null;
    budzet_planirani: number | null;
    spent: number;
    over_budget: boolean;
  };
  hard_blocks: { code: string; message: string; count?: number }[];
  warnings: { code: string; message: string; value?: any }[];
  ok_to_close: boolean;
};

export async function getCloseCheck(projekatId: number): Promise<CloseCheck | null> {
  // 1) Projekat + core_faza
  const pRows = await query(
    `
    SELECT p.projekat_id, p.status_id, p.budzet_planirani, s.core_faza
    FROM projekti p
    JOIN statusi_projekta s ON s.status_id = p.status_id
    WHERE p.projekat_id = ?
    `,
    [projekatId]
  );

  const p = pRows[0];
  if (!p) return null;

  // 2) Summary troškova
  const tRows = await query(
    `
    SELECT
      COUNT(*) AS broj_troskova,
      COALESCE(SUM(iznos_km),0) AS ukupno_km,
      MAX(datum_troska) AS zadnji_trosak
    FROM projektni_troskovi
    WHERE projekat_id = ?
    `,
    [projekatId]
  );
  const t = tRows[0] ?? {};

  const spent = Number(t.ukupno_km ?? 0);
  const budzet = p.budzet_planirani == null ? null : Number(p.budzet_planirani);
  const overBudget = budzet != null && spent > budzet;

  const hard_blocks: CloseCheck["hard_blocks"] = [];
  const warnings: CloseCheck["warnings"] = [];

  // HARD BLOCK: već zatvoren
  if (p.core_faza === "closed") {
    hard_blocks.push({
      code: "ALREADY_CLOSED",
      message: "Projekat je već zatvoren (closed).",
    });
  }

  // HARD BLOCK: bank postinzi za projekat koji nisu prebačeni u troškove (trosak_row_id je NULL)
  const bRows = await query(
    `
    SELECT COUNT(*) AS cnt
    FROM bank_tx_posting bp
    LEFT JOIN bank_tx_cost_link l ON l.posting_id = bp.posting_id
    WHERE bp.projekat_id = ?
      AND bp.reversed_at IS NULL
      AND l.trosak_row_id IS NULL
    `,
    [projekatId]
  );
  const uncommitted = Number(bRows[0]?.cnt ?? 0);
  if (uncommitted > 0) {
    hard_blocks.push({
      code: "BANK_UNCOMMITTED",
      message: "Postoje bank postinzi koji nisu prebačeni u troškove projekta.",
      count: uncommitted,
    });
  }

  // WARNING: over budget
  if (overBudget) {
    warnings.push({
      code: "OVER_BUDGET",
      message: "Projekat je preko budžeta.",
      value: { budzet_planirani: budzet, spent },
    });
  }

  // WARNING: reverzovani postinzi (storno) - informativno
  const rRows = await query(
    `
    SELECT COUNT(*) AS cnt
    FROM bank_tx_posting bp
    WHERE bp.projekat_id = ?
      AND bp.reversed_at IS NOT NULL
    `,
    [projekatId]
  );
  const reversed = Number(rRows[0]?.cnt ?? 0);
  if (reversed > 0) {
    warnings.push({
      code: "BANK_REVERSED",
      message: `Postoji ${reversed} reverzovanih bank posting-a (storno).`,
    });
  }

  const ok_to_close = hard_blocks.length === 0;

  return {
    projekat_id: Number(p.projekat_id),
    core_faza: (p.core_faza as CoreFaza) ?? null,
    status_id: Number(p.status_id),
    summary: {
      broj_troskova: Number(t.broj_troskova ?? 0),
      ukupno_km: spent,
      zadnji_trosak: t.zadnji_trosak ?? null,
      budzet_planirani: budzet,
      spent,
      over_budget: overBudget,
    },
    hard_blocks,
    warnings,
    ok_to_close,
  };
}
