// src/app/api/projects/[id]/final-ok/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

function getIdFromUrl(req: Request): number | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // očekujemo: api / projects / {id} / final-ok
    const i = parts.indexOf("projects");
    if (i === -1) return null;
    const raw = parts[i + 1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function getUserLabel(req: Request) {
  return (
    req.headers.get("x-user") ||
    req.headers.get("x-user-email") ||
    req.headers.get("x-user-name") ||
    "system"
  );
}

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
}

async function getFinalOkCheck(projekatId: number) {
  const rows = await query(
    `
    SELECT
      p.projekat_id,
      p.status_id,
      s.naziv_statusa,
      v.budzet_planirani,
      v.troskovi_ukupno
    FROM projekti p
    LEFT JOIN statusi_projekta s ON s.status_id = p.status_id
    LEFT JOIN vw_projekti_finansije v ON v.projekat_id = p.projekat_id
    WHERE p.projekat_id = ?
    LIMIT 1
    `,
    [projekatId]
  );

  const p = rows?.[0];
  if (!p) return null;

  const status_id = Number(p.status_id);
  const status_name = p.naziv_statusa ? String(p.naziv_statusa) : null;

  const budzet =
    p.budzet_planirani === null || p.budzet_planirani === undefined
      ? null
      : Number(p.budzet_planirani);

  const troskovi = Number(p.troskovi_ukupno ?? 0);

  const hard_blocks: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string; value?: any }[] = [];

  if (status_id === 9) {
    hard_blocks.push({
      code: "ALREADY_IN_SAFE",
      message: "Projekat je već fakturisan (read-only). FINAL OK nije moguće.",
    });
  }
  if (status_id === 10) {
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

  return {
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
}

export async function POST(req: Request) {
  const projekatId = getIdFromUrl(req);
  if (!projekatId) {
    return NextResponse.json({ ok: false, error: "BAD_ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const force = Boolean((body as any)?.force);

  const check = await getFinalOkCheck(projekatId);
  if (!check) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (!check.ok_to_final) {
    return NextResponse.json(
      { ok: false, error: "FINAL_BLOCKED", ...check },
      { status: 409 }
    );
  }

  if ((check.warnings?.length ?? 0) > 0 && !force) {
    return NextResponse.json(
      { ok: false, error: "FINAL_NEEDS_CONFIRM", ...check },
      { status: 409 }
    );
  }

  // FINAL OK = produkcija završena → status_id = 7 ("Završen")
  // NAPOMENA: ovo NIJE klijentska potvrda i ne zaključava projekat.
  await query(
    `
    UPDATE projekti
    SET status_id = 7
    WHERE projekat_id = ?
    LIMIT 1
    `,
    [projekatId]
  );

  // Audit
  const user_label = getUserLabel(req);
  const ip = getIp(req);
  const details = {
    force,
    warnings: check.warnings,
    summary: check.summary,
    note: "FINAL OK (produkcija završena — čeka se komunikacija s klijentom)",
  };

  await query(
    `
    INSERT INTO project_audit (projekat_id, action, details, user_label, ip)
    VALUES (?, 'PROJECT_FINAL_OK', CAST(? AS JSON), ?, ?)
    `,
    [projekatId, JSON.stringify(details), user_label, ip]
  );

  const after = await getFinalOkCheck(projekatId);

  return NextResponse.json(
    {
      ok: true,
      message: "FINAL OK upisan. Projekat je prebačen u status 'Završen'.",
      projekat_id: projekatId,
      after,
    },
    { status: 200 }
  );
}
