// src/app/api/tenant-admin/billing/route.ts
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  calculateProRata,
  buildLicenceItemDescription,
  LEGAL_NOTE_BS,
  LEGAL_NOTE_EN,
} from "@/lib/tenant-billing";

export const dynamic = "force-dynamic";

function requireTenantAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  if (process.env.ENABLE_TENANT_ADMIN !== "true") {
    return {
      error: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }),
      session: null,
    };
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
      session: null,
    };
  }
  const session = verifySessionToken(token);
  if (!session) {
    return {
      error: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = requireTenantAdmin(cookieStore);
  if (auth.error || !auth.session) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const action = String(body?.action ?? "").trim();

  // 1. Pro-rata kalkulator
  if (action === "calculate-prorata") {
    const monthlyPrice = Number(body?.monthly_price ?? 0);
    const startDate = body?.start_date ? String(body.start_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const calc = calculateProRata(monthlyPrice, startDate);
    return NextResponse.json({ ok: true, ...calc });
  }

  // 2. Grace +48h produženje (dok banka ne proknjiži izvod)
  if (action === "grace-extend") {
    const tenantId = Number(body?.tenant_id);
    const hours = Number(body?.hours ?? 48); // default 48h
    if (!tenantId || tenantId <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_TENANT_ID" }, { status: 400 });
    }

    // Učitaj trenutni datum isteka
    const [tRows]: any = await query(
      "SELECT tenant_id, naziv, status, subscription_ends_at FROM tenants WHERE tenant_id = ? LIMIT 1",
      [tenantId]
    );
    if (!tRows || tRows.length === 0) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404 });
    }

    const tenant = tRows[0];
    const now = new Date();
    let currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    if (currentEnd.getTime() < now.getTime()) {
      currentEnd = now;
    }

    // Dodaj sate (npr. 48h = 2 dana)
    const newEnd = new Date(currentEnd.getTime() + hours * 3600 * 1000);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const newEndStr = `${newEnd.getFullYear()}-${pad2(newEnd.getMonth() + 1)}-${pad2(newEnd.getDate())}`;

    await query(
      "UPDATE tenants SET subscription_ends_at = ?, status = 'AKTIVAN', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
      [newEndStr, tenantId]
    );

    return NextResponse.json({
      ok: true,
      message: `Tenant "${tenant.naziv}" je uspješno produžen za +${hours}h (do ${newEndStr}).`,
      subscription_ends_at: newEndStr,
      status: "AKTIVAN",
    });
  }

  // 3. Generiši specifikaciju mjesečnog računa za tenanta
  if (action === "prepare-subscription-invoice") {
    const tenantId = Number(body?.tenant_id);
    if (!tenantId || tenantId <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_TENANT_ID" }, { status: 400 });
    }

    const [tRows]: any = await query(`
      SELECT t.tenant_id, t.naziv, t.monthly_price, t.currency, t.klijent_id,
             t.studio_licence_profile, k.naziv_klijenta, k.jib, k.porezni_id, k.is_ino
      FROM tenants t
      LEFT JOIN klijenti k ON t.klijent_id = k.klijent_id
      WHERE t.tenant_id = ?
      LIMIT 1
    `, [tenantId]);

    if (!tRows || tRows.length === 0) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404 });
    }

    const t = tRows[0];
    const now = new Date();
    const periodYear = body?.year ? Number(body.year) : now.getFullYear();
    const periodMonth = body?.month ? Number(body.month) : (now.getMonth() + 1);

    const appName = t.studio_licence_profile || t.naziv;
    const desc = buildLicenceItemDescription(appName, periodYear, periodMonth);
    const isIso = Boolean(t.is_ino) || (t.currency || "").toUpperCase() === "EUR";
    const legalNote = isIso ? LEGAL_NOTE_EN : LEGAL_NOTE_BS;

    return NextResponse.json({
      ok: true,
      tenant_id: t.tenant_id,
      tenant_naziv: t.naziv,
      klijent_id: t.klijent_id,
      klijent_naziv: t.naziv_klijenta || t.naziv,
      monthly_price: Number(t.monthly_price) || 0,
      currency: (t.currency || "BAM").toUpperCase(),
      item_title: `Zakup softverske licence — ${appName}`,
      item_description: desc,
      legal_note: legalNote,
      is_ino: isIso,
    });
  }

  // 4. Evidencija uplate (Banka vs Keš) sa popustima za avansno plaćanje (6 mj: -10%, 12 mj: -15%, 24 mj: -20%)
  if (action === "record-payment") {
    const tenantId = Number(body?.tenant_id);
    const months = Number(body?.months || 1); // 1, 6, 12, 24
    const paymentMethod = body?.payment_method === "kes" ? "kes" : "banka";
    const discountPercent = months === 24 ? 20 : months === 12 ? 15 : months === 6 ? 10 : 0;

    if (!tenantId || tenantId <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_TENANT_ID" }, { status: 400 });
    }

    const [tRows]: any = await query(
      "SELECT tenant_id, naziv, monthly_price, currency, subscription_ends_at FROM tenants WHERE tenant_id = ? LIMIT 1",
      [tenantId]
    );
    if (!tRows || tRows.length === 0) {
      return NextResponse.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404 });
    }

    const tenant = tRows[0];
    const now = new Date();
    let currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    if (currentEnd.getTime() < now.getTime()) {
      currentEnd = now;
    }

    // Dodaj broj mjeseci na subscription_ends_at
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + months);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const newEndStr = `${newEnd.getFullYear()}-${pad2(newEnd.getMonth() + 1)}-${pad2(newEnd.getDate())}`;

    const baseAmount = (Number(tenant.monthly_price) || 0) * months;
    const discountAmount = (baseAmount * discountPercent) / 100;
    const finalAmount = baseAmount - discountAmount;

    await query(
      "UPDATE tenants SET subscription_ends_at = ?, status = 'AKTIVAN', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
      [newEndStr, tenantId]
    );

    return NextResponse.json({
      ok: true,
      tenant_id: tenantId,
      months,
      payment_method: paymentMethod,
      discount_percent: discountPercent,
      base_amount: baseAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      currency: tenant.currency || "KM",
      subscription_ends_at: newEndStr,
      message: paymentMethod === "kes"
        ? `Uplata u kešu (${finalAmount.toFixed(2)} ${tenant.currency || "KM"}) uspješno evidentirana. Licenca produžena za ${months} mj. (do ${newEndStr}) bez KIF fakture.`
        : `Žiralna uplata (${finalAmount.toFixed(2)} ${tenant.currency || "KM"}) evidentirana. Licenca produžena za ${months} mj. (do ${newEndStr}). Faktura ide u KIF kroz izvod.`,
    });
  }

  return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
}
