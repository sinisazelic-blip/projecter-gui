// POST: poziv prema fiskalnom uređaju (L-PFR) – Create Invoice
// Format kao JP Aquana / OFS P5: POST /api/invoices, Bearer auth, body { email, invoiceRequest, print }.
// Koristi postavke iz firma_fiskal_settings (base_url, api_path, api_key).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type FiskalItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  vatRate: number;
};

type Body = {
  items: FiskalItem[];
  totalAmount: number;
  discountNet?: number;
  dateISO?: string;
  /** PIB ili JIB kupca; za INO kupca front šalje "9999999999999" */
  buyerTaxId?: string;
  /** Naziv kupca (pravnog lica) za fiskalni račun */
  buyerName?: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseLprErrorCode(text: string | null | undefined): null | {
  code: string;
  hint: string;
} {
  if (!text) return null;
  const m = String(text).trim().match(/^(\d{4})$/);
  if (!m) return null;
  const code = m[1];
  const hint =
    code === "1300"
      ? "1300: Smart Card is not present (kartica/BE nije prisutan)"
      : code === "1500"
        ? "1500: Pin Code Required (potreban PIN na uređaju)"
        : code === "2100"
          ? "2100: Pin Not OK (pogrešan PIN)"
          : code === "0100"
            ? "0100: Pin OK"
            : `${code}: (nepoznat kod)`;
  return { code, hint };
}

function buildInvoiceItems(body: Body) {
  const discountNet = Number(body.discountNet ?? 0) || 0;

  // Fluxa stavke su osnovica (bez PDV-a). Fiskalni uređaj očekuje iznose SA PDV-om,
  // a label koristi da izvede PDV iz bruto iznosa.
  const items: any[] = (body.items || []).map((it) => {
    const rate = Number(it.vatRate || 0) / 100;
    const unitNet = Number(it.unitPrice) ?? 0;
    const totalNet = Number(it.totalAmount) ?? 0;
    const unitGross = round2(unitNet * (1 + rate));
    const totalGross = round2(totalNet * (1 + rate));
    return {
      gtin: "00000000",
      name: String(it.name || "").slice(0, 2048),
      quantity: Math.max(0.001, Number(it.quantity) || 1),
      unitPrice: unitGross,
      totalAmount: totalGross,
      // Uređaj u /api/status vraća šifrarnik sa ćiriličnim label-ima (Е, К, А). Validacija vjerovatno traži tačno to.
      labels: rate > 0 ? ["\u0415"] : ["\u041A"],
    };
  });

  // Popust (neto) dodaj kao negativnu stavku, u bruto iznosu (da zbir bude konzistentan).
  if (discountNet > 0 && items.length > 0) {
    const first = items[0];
    const isE = Array.isArray(first.labels) && (first.labels.includes("\u0415") || first.labels.includes("E"));
    const discountRate = isE ? 0.17 : 0;
    const discountGross = round2(discountNet * (1 + discountRate));
    if (discountGross > 0) {
      items.push({
        gtin: "00000000",
        name: "Popust",
        quantity: 1,
        unitPrice: -discountGross,
        totalAmount: -discountGross,
        labels: isE ? ["\u0415"] : ["\u041A"],
      });
    }
  }

  return items;
}

function normalizeBuyerId(body: Body) {
  const buyerTaxIdRaw = body.buyerTaxId != null
    ? String(body.buyerTaxId).trim().slice(0, 30)
    : "";
  const buyerId = buyerTaxIdRaw.replace(/[^\d]/g, "").slice(0, 20);
  return buyerId;
}

function buildInvoiceRequestV3(body: Body) {
  // API /api/v3/invoices očekuje dateAndTimeOfIssue.
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000Z`
      : new Date().toISOString();

  const items = buildInvoiceItems(body);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );

  const buyerId = normalizeBuyerId(body);

  // Format iz tehničke dokumentacije (v3): invoiceType/transactionType/paymentType su stringovi.
  const invoiceRequest: any = {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    ...(buyerId ? { buyerId } : {}),
    invoiceType: "Normal",
    transactionType: "Sale",
    invoiceNumber: null,
    items,
    payment: [{ amount: paymentAmount, paymentType: "WireTransfer" }],
  };
  return invoiceRequest;
}

function buildInvoiceRequestApiInvoices(body: Body) {
  // Wrapper /api/invoices: payload treba da liči na Create-Invoice primjer (hibridni tipovi).
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000Z`
      : new Date().toISOString();

  const items = buildInvoiceItems(body);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerId = normalizeBuyerId(body);

  return {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    ...(buyerId ? { buyerId } : {}),
    ...(buyerId ? { buyerCostCenterId: `T-${buyerId}` } : {}),
    invoiceNumber: null,
    invoiceType: 0,
    transactionType: "Sale",
    options: {
      omitQRCodeGen: "0",
      omitTextualRepresentation: "0",
    },
    items,
    payment: [{ amount: paymentAmount, paymentType: 4 }],
  };
}

function buildInvoiceRequestApiInvoicesMinimal(body: Body) {
  // Najmanji mogući payload: bez buyerId/date/options da otkrijemo šta ruši validaciju.
  const items = buildInvoiceItems(body);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  return {
    cashier: "Prodavac 1",
    invoiceType: 0,
    transactionType: 0,
    items,
    payment: [{ amount: paymentAmount, paymentType: 4 }],
  };
}

function buildInvoicePrintRequest(invoiceRequest: any) {
  return {
    email: null,
    invoiceRequest,
    // Uređaj očekuje ArrayList<String> na wrapper nivou
    receiptFooterTextLines: [],
    receiptHeaderTextLines: [],
    print: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const active = await query(
      `SELECT firma_id FROM firma_profile WHERE is_active = 1 ORDER BY firma_id DESC LIMIT 1`,
    );
    const firmaId = (active as any[])?.[0]?.firma_id;
    if (!firmaId) {
      return NextResponse.json(
        { ok: false, error: "Nema aktivne firme" },
        { status: 400 },
      );
    }

    const rows = await query(
      `SELECT base_url, api_path, api_key, yid FROM firma_fiskal_settings WHERE firma_id = ?`,
      [firmaId],
    );
    const settings = (rows as any[])?.[0];
    const baseUrl = settings?.base_url?.trim?.();
    let apiPath = settings?.api_path?.trim?.();
    if (!apiPath) apiPath = "/";
    else if (!apiPath.startsWith("/")) apiPath = "/" + apiPath;
    const apiKey = settings?.api_key?.trim?.();
    const yid = settings?.yid?.trim?.();

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "Postavke fiskalnog uređaja: Base URL nije unesen" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.items?.length || !Number.isFinite(body.totalAmount)) {
      return NextResponse.json(
        { ok: false, error: "Nedostaju stavke ili ukupan iznos" },
        { status: 400 },
      );
    }

    const base = baseUrl.replace(/\/$/, "");
    const baseWithScheme =
      /^https?:\/\//i.test(base) ? base : `http://${base}`;
    const url = `${baseWithScheme}${apiPath}`;

    const normalizedPath = apiPath.toLowerCase();
    const isApiInvoices =
      normalizedPath === "/api/invoices" || normalizedPath.endsWith("/api/invoices");
    const isApiV3Invoices =
      normalizedPath === "/api/v3/invoices" || normalizedPath.endsWith("/api/v3/invoices");

    // /api/invoices na ovom uređaju očekuje wrapper sa poljem invoiceRequest.
    // Kad smo poslali direktan v3 body, uređaj je vratio 500 NPE jer je invoiceRequest bio null.
    // Wrapper endpoint vraća 400 kad šaljemo string enum-e ("Normal","Sale","WireTransfer") – koristimo brojeve (0,0,4).
    const invoiceRequest = isApiV3Invoices
      ? buildInvoiceRequestV3(body)
      : buildInvoiceRequestApiInvoices(body);

    const requestBodyPrimary = isApiInvoices
      ? buildInvoicePrintRequest(invoiceRequest)
      : invoiceRequest;

    // Uređaj eksplicitno navodi dozvoljene headere u CORS listi; držimo se minimalnog skupa.
    const headers: Record<string, string> = {
      Accept: "text/plain, application/json, */*",
      "Content-Type": "application/json; charset=utf-8",
      RequestId: `req-${Date.now().toString(36)}`,
      // Tipično obavezno za Jersey/CSRF zaštitu; vrijednost može biti bilo šta.
      "X-Requested-By": yid || "req",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    async function postOnce(targetUrl: string, bodyObj: any) {
      const r = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj),
        signal: AbortSignal.timeout(30000),
      });
      const t = await r.text();
      let j: any = null;
      try {
        j = t ? JSON.parse(t) : null;
      } catch {
        j = null;
      }
      return { r, t, j };
    }

    // Pokušaj #1: “puni” payload
    let { r: res, t: text, j: data } = await postOnce(url, requestBodyPrimary);

    const shouldRetryToV3 = false;

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      const code = parseLprErrorCode(text);
      const deviceHeaders: Record<string, string> = {};
      try {
        for (const [k, v] of res.headers.entries()) deviceHeaders[k] = v;
      } catch {
        // ignore
      }

      // Opcioni probe status-a: kad je greška, probaj očitati /api/v3/status (kratki timeout) da dobijemo hint.
      let statusProbe: any = null;
      try {
        const statusUrl = `${baseWithScheme}/api/status`;
        const sr = await fetch(statusUrl, {
          method: "GET",
          headers: {
            Accept: "text/plain, application/json, */*",
            RequestId: headers.RequestId,
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            "X-Requested-By": headers["X-Requested-By"],
          },
          signal: AbortSignal.timeout(3000),
        });
        const st = await sr.text();
        statusProbe = {
          url: statusUrl,
          status: sr.status,
          contentType: sr.headers.get("content-type") || null,
          body: st ? st.slice(0, 300) : null,
          parsedCode: parseLprErrorCode(st),
        };
      } catch {
        statusProbe = null;
      }

      // Pokušaj #2 (samo kad #1 padne): minimalni payload bez buyerId/date/options
      let attempt2: any = null;
      try {
        if (isApiInvoices) {
          const minimalReq = buildInvoiceRequestApiInvoicesMinimal(body);
          const minimalBody = buildInvoicePrintRequest(minimalReq);
          const r2 = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(minimalBody),
            signal: AbortSignal.timeout(30000),
          });
          const t2 = await r2.text();
          attempt2 = {
            status: r2.status,
            contentType: r2.headers.get("content-type") || null,
            body: t2 ? t2.slice(0, 300) : null,
            parsedCode: parseLprErrorCode(t2),
            sentBody: minimalBody,
          };
        }
      } catch {
        attempt2 = null;
      }

      const errMsg =
        code?.hint ||
        data?.message ||
        data?.error ||
        data?.messages ||
        res.statusText ||
        text?.slice(0, 300);
      const deviceBody = data ?? (text ? text.slice(0, 500) : null);
      const detail =
        res.status === 500 && deviceBody
          ? ` ${typeof deviceBody === "string" ? deviceBody : JSON.stringify(deviceBody).slice(0, 200)}`
          : "";
      const safeHeaders = { ...headers };
      if (safeHeaders.Authorization) safeHeaders.Authorization = "Bearer ***";
      return NextResponse.json(
        {
          ok: false,
          error: `Fiskalni uređaj: ${res.status} ${errMsg}${detail}`,
          url,
          status: res.status,
          deviceContentType: contentType || null,
          deviceResponse: deviceBody,
          debug: {
            sentUrl: url,
            sentBody: requestBodyPrimary,
            sentHeaders: safeHeaders,
            statusProbe,
            deviceHeaders,
            attempt2,
          },
        },
        { status: 502 },
      );
    }

    // Odgovor uređaja (camelCase): verificationQrCode, totalCounter, invoiceNumber, sdcDateTime, itd.
    const totalCounter = data?.totalCounter != null ? Number(data.totalCounter) : null;
    return NextResponse.json({
      ok: true,
      verificationQRCode: data?.verificationQrCode ?? data?.verificationQRCode ?? null,
      sdcDateTime: data?.sdcDateTime ?? null,
      invoiceNumber: data?.invoiceNumber ?? null,
      invoiceCounter: data?.invoiceCounter ?? null,
      invoiceCounterExtension: data?.invoiceCounterExtension ?? null,
      totalCounter: Number.isFinite(totalCounter) ? totalCounter : null,
      transactionTypeCounter: data?.transactionTypeCounter ?? null,
      verificationUrl: data?.verificationUrl ?? null,
      journal: data?.journal ?? null,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("aborted");
    console.error("POST /api/fakture/fiskalizuj", e);
    return NextResponse.json(
      {
        ok: false,
        error: isTimeout
          ? "Fiskalni uređaj ne odgovara (timeout). Provjeri mrežu i Base URL."
          : `Greška: ${msg}`,
      },
      { status: 502 },
    );
  }
}
