// src/lib/projects/close.ts
import { query } from "@/lib/db";

type CloseCheck = {
  projekat_id: number;
  status_id: number;
  status_name: string | null;
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
  // 1) Projekat + naziv statusa + kanonski budžet (view)
  const pRows = await query(
    `
    SELECT
      p.projekat_id,
      p.status_id,
      s.naziv_statusa,
      v.budzet_planirani
    FROM projekti p
    LEFT JOIN statusi_projekta s
      ON s.status_id = p.status_id
    LEFT JOIN vw_projekti_finansije v
      ON v.projekat_id = p.projekat_id
    WHERE p.projekat_id = ?
    LIMIT 1
    `,
    [projekatId]
  );

  const p = pRows?.[0];
  if (!p) return null;

  const status_id = Number(p.status_id ?? 0);
  const status_name = p.naziv_statusa ? String(p.naziv_statusa) : null;

  const budzet =
    p.budzet_planirani === null || p.budzet_planirani === undefined ? null : Number(p.budzet_planirani);

  // 2) Summary troškova (bez STORNIRANO)
  const tRows = await query(
    `
    SELECT
      COUNT(*) AS broj_troskova,
      COALESCE(SUM(CASE WHEN status <> 'STORNIRANO' THEN iznos_km ELSE 0 END), 0) AS ukupno_km,
      MAX(CASE WHEN status <> 'STORNIRANO' THEN datum_troska ELSE NULL END) AS zadnji_trosak
    FROM projektni_troskovi
    WHERE projekat_id = ?
    `,
    [projekatId]
  );

  const t = tRows?.[0] ?? {};
  const spent = Number(t.ukupno_km ?? 0);
  const overBudget = budzet != null && spent > budzet;

  const hard_blocks: CloseCheck["hard_blocks"] = [];
  const warnings: CloseCheck["warnings"] = [];

  /**
   * HARD BLOCK pravila:
   * - ne smije se zatvarati ako je Zatvoren/Fakturisan/Arhiviran/Otkazan
   * - zatvaranje (ZATVOREN = 8) smije doći tek nakon FINAL OK (status 7 = Završen)
   */
  if (status_id === 8) {
    hard_blocks.push({
      code: "ALREADY_CLOSED",
      message: "Projekat je već u statusu 'Zatvoren'.",
    });
  }
  if (status_id === 9) {
    hard_blocks.push({
      code: "ALREADY_INVOICED",
      message: "Projekat je već fakturisan (read-only). Zatvaranje nije moguće.",
    });
  }
  if (status_id === 10) {
    hard_blocks.push({
      code: "ALREADY_ARCHIVED",
      message: "Projekat je već arhiviran. Zatvaranje nije moguće.",
    });
  }
  if (status_id === 12) {
    hard_blocks.push({
      code: "CANCELLED",
      message: "Projekat je otkazan. Zatvaranje nije moguće.",
    });
  }

  // mora biti bar FINAL OK (7)
  if (status_id < 7) {
    hard_blocks.push({
      code: "NOT_READY",
      message: "Projekat nije u statusu 'Završen' (FINAL OK). Prvo završi produkciju (status 7).",
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

  const uncommitted = Number(bRows?.[0]?.cnt ?? 0);
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

  const reversed = Number(rRows?.[0]?.cnt ?? 0);
  if (reversed > 0) {
    warnings.push({
      code: "BANK_REVERSED",
      message: `Postoji ${reversed} reverzovanih bank posting-a (storno).`,
    });
  }

  const ok_to_close = hard_blocks.length === 0;

  return {
    projekat_id: Number(p.projekat_id),
    status_id,
    status_name,
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
