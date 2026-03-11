// src/app/api/projects/[id]/final-ok-check/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // očekujemo: api / projects / {id} / final-ok-check
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type FinalOkCheck = {
  ok_to_final: boolean;
  hard_blocks: { code: string; message: string }[];
  warnings: { code: string; message: string; value?: any }[];
  summary: {
    status_id: number;
    status_name: string | null;
    budzet_planirani: number | null;
    troskovi_ukupno: number;
    over_budget: boolean;
  };
};

export async function GET(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  // Budžet: prvo staging (projekat_stavke), pa view (ista logika kao detalj i lista)
  const EUR_TO_BAM = 1.95583;
  const rows = await query(
    `
    SELECT
      p.projekat_id,
      p.status_id,
      s.naziv_statusa,
      COALESCE(ps.budzet_km, v.budzet_planirani, 0) AS budzet_planirani,
      COALESCE(v.troskovi_ukupno, 0) AS troskovi_ukupno
    FROM projekti p
    LEFT JOIN statusi_projekta s ON s.status_id = p.status_id
    LEFT JOIN vw_projekti_finansije v ON v.projekat_id = p.projekat_id
    LEFT JOIN (
      SELECT ps1.projekat_id,
        ROUND(SUM(
          CASE
            WHEN UPPER(COALESCE(ps1.valuta, 'BAM')) IN ('BAM','KM') THEN COALESCE(ps1.line_total, 0)
            WHEN UPPER(COALESCE(ps1.valuta, '')) = 'EUR' THEN COALESCE(ps1.line_total, 0) * ?
            ELSE 0
          END
        ), 2) AS budzet_km
      FROM projekat_stavke ps1
      LEFT JOIN (
        SELECT projekat_id, MAX(IFNULL(snapshot_id, 0)) AS snapshot_id
        FROM projekat_stavke
        GROUP BY projekat_id
      ) ls ON ls.projekat_id = ps1.projekat_id
      WHERE IFNULL(ps1.snapshot_id, 0) = COALESCE(ls.snapshot_id, 0)
      GROUP BY ps1.projekat_id
    ) ps ON ps.projekat_id = p.projekat_id
    WHERE p.projekat_id = ?
    LIMIT 1
    `,
    [EUR_TO_BAM, projekatId],
  );

  const p = rows?.[0];
  if (!p) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const status_id = Number(p.status_id);
  const status_name = p.naziv_statusa ? String(p.naziv_statusa) : null;

  const budzet =
    p.budzet_planirani === null || p.budzet_planirani === undefined
      ? null
      : Number(p.budzet_planirani);

  const troskovi = Number(p.troskovi_ukupno ?? 0);

  const hard_blocks: FinalOkCheck["hard_blocks"] = [];
  const warnings: FinalOkCheck["warnings"] = [];

  // HARD BLOCK: ne može FINAL OK ako je projekat u "sefu" ili zatvoren poslovno na način koji je nepovratan
  // 9 = Fakturisan (read-only)
  // 10 = Arhiviran (kasnije, bank import)
  // 12 = Otkazan (closed)
  if (status_id === 9) {
    hard_blocks.push({
      code: "ALREADY_IN_SAFE",
      message: "Projekat je već fakturisan (read-only). FINAL OK nije moguće.",
    });
  }
  if (status_id === 10 || status_id === 11) {
    hard_blocks.push({
      code: "ALREADY_ARCHIVED",
      message: "Projekat je već arhiviran. FINAL OK nije moguće.",
    });
  }
  if (status_id === 12) {
    hard_blocks.push({
      code: "CANCELLED",
      message: "Projekat je otkazan. FINAL OK nije moguće.",
    });
  }

  // (opciono) Ako je već Završen, tretiramo kao idempotentno stanje — nema blokade, ali dajemo info warning
  if (status_id === 7) {
    warnings.push({
      code: "ALREADY_FINAL_OK",
      message: "Projekat je već u statusu 'Završen' (FINAL OK).",
    });
  }

  const overBudget = budzet != null && troskovi > budzet;
  if (overBudget) {
    warnings.push({
      code: "OVER_BUDGET",
      message: "Projekat je preko budžeta.",
      value: { budzet_planirani: budzet, troskovi_ukupno: troskovi },
    });
  }

  const ok_to_final = hard_blocks.length === 0;

  const payload: FinalOkCheck = {
    ok_to_final,
    hard_blocks,
    warnings,
    summary: {
      status_id,
      status_name,
      budzet_planirani: budzet,
      troskovi_ukupno: troskovi,
      over_budget: overBudget,
    },
  };

  return NextResponse.json({ ok: true, ...payload }, { status: 200 });
}
