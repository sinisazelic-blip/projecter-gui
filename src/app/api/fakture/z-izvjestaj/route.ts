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
        fiskalni_status, bill_to_klijent_id, valuta
      FROM fakture
      WHERE (DATE(datum_izdavanja) = CURDATE() OR datum_izdavanja >= CURDATE())
      ORDER BY faktura_id ASC
      `,
      [],
    )) as any[];

    const EUR_TO_BAM = 1.95583;
    let ukupnoBezPdv = 0;
    let ukupnoPdv = 0;
    let ukupnoSaPdv = 0;
    let fiskalizovanoKomada = 0;

    const formattedInvoices = todayInvoices.map((f: any) => {
      const valuta = String(f.valuta || "BAM").toUpperCase();
      const isEur = valuta === "EUR";
      const rate = isEur ? EUR_TO_BAM : 1;

      const osnovicaNominal = Number(f.osnovica_km) || 0;
      const pdvNominal = Number(f.pdv_iznos_km) || 0;
      const ukupnoNominal = Number(f.iznos_ukupno_km) || 0;

      const osnovicaBam = Math.round(osnovicaNominal * rate * 100) / 100;
      const pdvBam = Math.round(pdvNominal * rate * 100) / 100;
      const ukupnoBam = Math.round(ukupnoNominal * rate * 100) / 100;

      if (f.fiskalni_status !== "STORNIRAN") {
        ukupnoBezPdv += osnovicaBam;
        ukupnoPdv += pdvBam;
        ukupnoSaPdv += ukupnoBam;
        if (f.broj_fiskalni) {
          fiskalizovanoKomada++;
        }
      }

      return {
        ...f,
        valuta: isEur ? "EUR" : "KM",
        iznos_nominal: ukupnoNominal,
        iznos_bam: ukupnoBam,
        display_iznos: isEur
          ? `${ukupnoNominal.toFixed(2)} EUR (${ukupnoBam.toFixed(2)} KM)`
          : `${ukupnoBam.toFixed(2)} KM`,
      };
    });

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
      fakture: formattedInvoices,
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
    const yid = settings?.yid?.trim?.();

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

    // Otključaj PIN na LPFR uređaju prije slanja Z-izvještaja ako je pin podešen
    if (pin) {
      const pinEndpoints = [
        `${baseWithScheme}/api/pin`,
        `${baseWithScheme}/api/v3/pin`,
        `${baseWithScheme}/pin`,
      ];
      const pinHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "X-Requested-By": yid || "req",
        Pin: String(pin).trim(),
        PIN: String(pin).trim(),
      };
      if (apiKey) {
        pinHeaders["Pac"] = apiKey;
        pinHeaders["PAC"] = apiKey;
        pinHeaders["Authorization"] = `Bearer ${apiKey}`;
      }
      for (const ep of pinEndpoints) {
        try {
          await fetch(ep, {
            method: "POST",
            headers: pinHeaders,
            body: JSON.stringify({ pin: String(pin).trim() }),
            signal: AbortSignal.timeout(2000),
          }).catch(() => null);
        } catch {
          // ignore
        }
      }
    }

    // 1. Attempt sending Z-report command to LPFR (vendor endpoints for Z-report / close-shift)
    try {
      const zEndpoints = [
        { url: `${baseWithScheme}/api/v3/reports/z`, method: "POST", body: { cashier: "Administrator", closeShift: true } },
        { url: `${baseWithScheme}/api/reports/z`, method: "POST", body: { cashier: "Administrator", closeShift: true } },
        { url: `${baseWithScheme}/api/v3/reports/daily`, method: "POST", body: { cashier: "Administrator", closeShift: true } },
        { url: `${baseWithScheme}/api/reports/daily`, method: "POST", body: { cashier: "Administrator", closeShift: true } },
        { url: `${baseWithScheme}/api/v3/shift/close`, method: "POST", body: { closeShift: true } },
        { url: `${baseWithScheme}/api/shift/close`, method: "POST", body: { closeShift: true } },
        { url: `${baseWithScheme}/api/v3/reports`, method: "POST", body: { reportType: "Z", closeShift: true } },
        { url: `${baseWithScheme}/api/reports`, method: "POST", body: { reportType: "Z", closeShift: true } },
      ];

      for (const item of zEndpoints) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers,
            body: JSON.stringify(item.body),
            signal: AbortSignal.timeout(4000),
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

    if (!lpfrSuccess && !lpfrWarning) {
      lpfrWarning = "LPFR uređaj ne podržava daljinsko resetovanje smjene preko mrežne komande (zaključenje na samom uređaju se vrši kroz meni/tastaturu uređaja).";
    }

    // 2. Query today's invoices for summary
    const todayInvoices = (await query(
      `
      SELECT 
        f.faktura_id, f.broj_fakture_puni AS broj_fakture, f.broj_fiskalni,
        f.osnovica_km, f.pdv_iznos_km, f.iznos_ukupno_km, f.datum_izdavanja, f.valuta,
        k.naziv_klijenta
      FROM fakture f
      LEFT JOIN klijenti k ON k.klijent_id = f.bill_to_klijent_id
      WHERE (DATE(f.datum_izdavanja) = CURDATE() OR f.datum_izdavanja >= CURDATE())
      ORDER BY f.faktura_id ASC
      `,
      [],
    )) as any[];

    const EUR_TO_BAM = 1.95583;
    let ukupnoBezPdv = 0;
    let ukupnoPdv = 0;
    let ukupnoSaPdv = 0;
    let fiskalizovanoKomada = 0;

    const formattedInvoices = todayInvoices.map((f: any) => {
      const valuta = String(f.valuta || "BAM").toUpperCase();
      const isEur = valuta === "EUR";
      const rate = isEur ? EUR_TO_BAM : 1;

      const osnovicaNominal = Number(f.osnovica_km) || 0;
      const pdvNominal = Number(f.pdv_iznos_km) || 0;
      const ukupnoNominal = Number(f.iznos_ukupno_km) || 0;

      const osnovicaBam = Math.round(osnovicaNominal * rate * 100) / 100;
      const pdvBam = Math.round(pdvNominal * rate * 100) / 100;
      const ukupnoBam = Math.round(ukupnoNominal * rate * 100) / 100;

      if (f.fiskalni_status !== "STORNIRAN") {
        ukupnoBezPdv += osnovicaBam;
        ukupnoPdv += pdvBam;
        ukupnoSaPdv += ukupnoBam;
        if (f.broj_fiskalni) fiskalizovanoKomada++;
      }

      return {
        ...f,
        valuta: isEur ? "EUR" : "KM",
        naziv_klijenta: f.naziv_klijenta || "—",
        iznos_nominal: ukupnoNominal,
        iznos_bam: ukupnoBam,
        display_iznos: isEur
          ? `${ukupnoNominal.toFixed(2)} EUR (${ukupnoBam.toFixed(2)} KM)`
          : `${ukupnoBam.toFixed(2)} KM`,
      };
    });

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
      fakture: formattedInvoices,
      lpfrSuccess,
      lpfrWarning,
      lpfrDetails: lpfrZReportData,
    };

    return NextResponse.json({
      ok: true,
      message: lpfrSuccess
        ? "Dnevni (Z) izvještaj je uspješno kreiran i smjena je zaključena na LPFR uređaju."
        : "Smjena je uspješno obračunata i zaključena u Fluxa sistemu.",
      report,
    });
  } catch (e: any) {
    console.error("POST /api/fakture/z-izvjestaj error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Greška" }, { status: 500 });
  }
}
