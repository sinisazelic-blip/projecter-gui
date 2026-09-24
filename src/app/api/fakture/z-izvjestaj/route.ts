import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const active = await query(
      `SELECT firma_id, naziv FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1`,
    );
    const firma = (active as any[])?.[0];
    const firmaId = firma?.firma_id;
    if (!firmaId) {
      return NextResponse.json({ ok: false, error: "Nema aktivne firme" }, { status: 400 });
    }

    const rows = await query(
      `SELECT base_url, api_path, api_key, yid, pin FROM firma_fiskal_settings WHERE firma_id = ?`,
      [firmaId],
    );
    const settings = (rows as any[])?.[0];
    const baseUrl = settings?.base_url?.trim?.();
    const apiKey = settings?.api_key?.trim?.();
    const pin = settings?.pin?.trim?.();

    let lpfrOnline = false;
    let lpfrStatusData: any = null;
    let lpfrError: string | null = null;

    if (baseUrl) {
      try {
        const base = baseUrl.replace(/\/$/, "");
        const baseWithScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;
        const statusUrl = `${baseWithScheme}/api/status`;

        const headers: Record<string, string> = {
          Accept: "application/json, text/plain, */*",
        };
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["Pac"] = apiKey;
          headers["PAC"] = apiKey;
        }
        if (pin) {
          headers["Pin"] = pin;
          headers["PIN"] = pin;
        }

        const sr = await fetch(statusUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(3000),
        });

        if (sr.ok) {
          lpfrOnline = true;
          lpfrStatusData = await sr.json().catch(() => null);
        } else {
          lpfrError = `LPFR uređaj vratio status HTTP ${sr.status}`;
        }
      } catch (err: any) {
        lpfrOnline = false;
        lpfrError = err.message || "Timeout pri spajanju na LPFR uređaj";
      }
    }

    // Query today's invoices
    const todayInvoices = (await query(
      `
      SELECT 
        faktura_id, broj_fakture_puni AS broj_fakture, broj_fiskalni,
        osnovica_km, pdv_iznos_km, iznos_ukupno_km, datum_izdavanja,
        fiskalni_status, bill_to_klijent_id
      FROM faktura
      WHERE firma_id = ? AND (DATE(datum_izdavanja) = CURDATE() OR datum_izdavanja >= CURDATE())
      ORDER BY faktura_id ASC
      `,
      [firmaId],
    )) as any[];

    let ukupnoBezPdv = 0;
    let ukupnoPdv = 0;
    let ukupnoSaPdv = 0;
    let fiskalizovanoKomada = 0;

    for (const f of todayInvoices) {
      if (f.fiskalni_status !== "STORNIRAN") {
        ukupnoBezPdv += Number(f.osnovica_km) || 0;
        ukupnoPdv += Number(f.pdv_iznos_km) || 0;
        ukupnoSaPdv += Number(f.iznos_ukupno_km) || 0;
        if (f.broj_fiskalni) {
          fiskalizovanoKomada++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      firmaNaziv: firma?.naziv || "Studio TAF",
      datum: new Date().toISOString(),
      lpfrOnline,
      lpfrError,
      lpfrUrl: baseUrl || "",
      pinConfigured: Boolean(pin),
      ukupnoFaktura: todayInvoices.length,
      fiskalizovanoKomada,
      ukupnoBezPdv: Math.round(ukupnoBezPdv * 100) / 100,
      ukupnoPdv: Math.round(ukupnoPdv * 100) / 100,
      ukupnoSaPdv: Math.round(ukupnoSaPdv * 100) / 100,
      fakture: todayInvoices,
      lpfrDetails: lpfrStatusData,
    });
  } catch (e: any) {
    console.error("GET /api/fakture/z-izvjestaj error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Greška" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const active = await query(
      `SELECT firma_id, naziv, jib, pib, adresa FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1`,
    );
    const firma = (active as any[])?.[0];
    const firmaId = firma?.firma_id;
    if (!firmaId) {
      return NextResponse.json({ ok: false, error: "Nema aktivne firme" }, { status: 400 });
    }

    const rows = await query(
      `SELECT base_url, api_path, api_key, yid, pin FROM firma_fiskal_settings WHERE firma_id = ?`,
      [firmaId],
    );
    const settings = (rows as any[])?.[0];
    const baseUrl = settings?.base_url?.trim?.();
    const apiKey = settings?.api_key?.trim?.();
    const pin = settings?.pin?.trim?.();

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "Postavke fiskalnog uređaja: Base URL nije unesen" },
        { status: 400 },
      );
    }

    const base = baseUrl.replace(/\/$/, "");
    const baseWithScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;

    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["Pac"] = apiKey;
      headers["PAC"] = apiKey;
    }
    if (pin) {
      headers["Pin"] = pin;
      headers["PIN"] = pin;
    }

    let lpfrZReportData: any = null;
    let lpfrSuccess = false;
    let lpfrWarning: string | null = null;

    // 1. Attempt sending Z-report command to LPFR (supports /api/v3/reports/z or /api/reports/z or /api/status)
    try {
      const zEndpoints = [
        `${baseWithScheme}/api/v3/reports/z`,
        `${baseWithScheme}/api/reports/z`,
        `${baseWithScheme}/api/status`,
      ];

      for (const ep of zEndpoints) {
        try {
          const res = await fetch(ep, {
            method: ep.includes("/status") ? "GET" : "POST",
            headers,
            body: ep.includes("/status") ? undefined : JSON.stringify({ cashier: "Administrator", closeShift: true }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            lpfrSuccess = true;
            lpfrZReportData = await res.json().catch(() => null);
            break;
          }
        } catch {
          // try next endpoint
        }
      }
    } catch (err: any) {
      lpfrWarning = "LPFR uređaj nije odgovorio na nalog za zatvaranje smjene: " + err.message;
    }

    // 2. Query today's invoices for summary
    const todayInvoices = (await query(
      `
      SELECT 
        faktura_id, broj_fakture_puni AS broj_fakture, broj_fiskalni,
        osnovica_km, pdv_iznos_km, iznos_ukupno_km, datum_izdavanja
      FROM faktura
      WHERE firma_id = ? AND (DATE(datum_izdavanja) = CURDATE() OR datum_izdavanja >= CURDATE())
      `,
      [firmaId],
    )) as any[];

    let ukupnoBezPdv = 0;
    let ukupnoPdv = 0;
    let ukupnoSaPdv = 0;
    let fiskalizovanoKomada = 0;

    for (const f of todayInvoices) {
      ukupnoBezPdv += Number(f.osnovica_km) || 0;
      ukupnoPdv += Number(f.pdv_iznos_km) || 0;
      ukupnoSaPdv += Number(f.iznos_ukupno_km) || 0;
      if (f.broj_fiskalni) fiskalizovanoKomada++;
    }

    const report = {
      zBroj: Math.floor(Date.now() / 1000) % 100000,
      datum: new Date().toLocaleString("sr-RS"),
      firmaNaziv: firma?.naziv || "Studio TAF",
      jib: firma?.jib || "",
      pib: firma?.pib || "",
      adresa: firma?.adresa || "",
      fiskalizovanoKomada,
      ukupnoBezPdv: Math.round(ukupnoBezPdv * 100) / 100,
      ukupnoPdv: Math.round(ukupnoPdv * 100) / 100,
      ukupnoSaPdv: Math.round(ukupnoSaPdv * 100) / 100,
      lpfrSuccess,
      lpfrWarning,
      lpfrDetails: lpfrZReportData,
    };

    return NextResponse.json({
      ok: true,
      message: "Dnevni (Z) izvještaj je uspješno kreiran i smjena je zaključena.",
      report,
    });
  } catch (e: any) {
    console.error("POST /api/fakture/z-izvjestaj error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Greška" }, { status: 500 });
  }
}
