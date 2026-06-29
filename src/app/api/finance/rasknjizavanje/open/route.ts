import { NextRequest, NextResponse } from "next/server";
import {
  getOpenInvoicesForClient,
  getOpenObaveze,
  searchClients,
  searchPartners,
} from "@/lib/finance/rasknjizavanje/queries";
import { getPartnerTolerancijaMax } from "@/lib/finance/rasknjizavanje/invoiceStatus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mode = sp.get("mode") || "invoices";

    if (mode === "clients") {
      const q = sp.get("q") || "";
      const clients = await searchClients(q);
      return NextResponse.json({ ok: true, clients });
    }

    if (mode === "partners") {
      const partnerTip = sp.get("partner_tip") === "talent" ? "talent" : "dobavljac";
      const q = sp.get("q") || "";
      const partners = await searchPartners(partnerTip, q);
      return NextResponse.json({ ok: true, partners, partner_tip: partnerTip });
    }

    if (mode === "obaveze") {
      const partnerTip = sp.get("partner_tip") === "talent" ? "talent" : "dobavljac";
      const partnerId = Number(sp.get("partner_id"));
      if (!Number.isFinite(partnerId) || partnerId <= 0) {
        return NextResponse.json({ ok: false, error: "partner_id invalid" }, { status: 400 });
      }
      const obaveze = await getOpenObaveze(partnerTip, partnerId);
      return NextResponse.json({ ok: true, obaveze, partner_tip: partnerTip, partner_id: partnerId });
    }

    const klijentId = Number(sp.get("klijent_id"));
    if (!Number.isFinite(klijentId) || klijentId <= 0) {
      return NextResponse.json({ ok: false, error: "klijent_id invalid" }, { status: 400 });
    }
    const invoices = await getOpenInvoicesForClient(klijentId);
    const tolerancija_max_km = await getPartnerTolerancijaMax("klijent", klijentId);
    return NextResponse.json({
      ok: true,
      klijent_id: klijentId,
      invoices,
      tolerancija_max_km,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
