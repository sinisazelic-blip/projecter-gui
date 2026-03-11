// POST: poziv prema fiskalnom uređaju (L-PFR / E-SDC) – Create Invoice
// Službeni PU spec: POST /api/v3/invoices, body = InvoiceRequest (bez wrappera). E-SDC ne zahtijeva auth.
// Headers: Accept, Content-Type, RequestId (max 32), Accept-Language (jezik journala).
// Neki uređaji/proxy vraćaju odgovor u obliku { Request, Response }; Response može biti objekt ili string ("Uređaj nije dostupan").
// Koristi postavke iz firma_fiskal_settings (base_url, api_path, api_key, yid).
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
  /** JIB kupca (13 cifara); za INO kupca front šalje "9999999999999". PU ne prihvata PIB (12 cifara). */
  buyerTaxId?: string;
  /** Naziv kupca (pravnog lica) za fiskalni račun */
  buyerName?: string;
  /** Broj računa u godini (za uređaj) – opciono */
  invoiceNumber?: number;
  /** Jezik za journal (Accept-Language), npr. "sr;en" – opciono */
  acceptLanguage?: string;
  /** Script PDV labela: test uređaji često traže latinicu, produkcija ćirilicu. */
  labelsScript?: "latin" | "cyrillic";
  /** Ako true: šalje invoiceType "Training" – PU ne računa račun, provjera vraća "Ovo nije fiskalni račun". */
  training?: boolean;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Status i error kodovi prema PU dokumentaciji (Status and Error Codes). */
const FISCAL_STATUS_CODES: Record<
  string,
  { desc: string; type: "info" | "warning" | "error"; retryable?: boolean }
> = {
  "0000": { desc: "All OK", type: "info" },
  "0100": { desc: "Pin OK – uneseni PIN je ispravan", type: "info" },
  "0210": { desc: "Internet Available", type: "info" },
  "0220": { desc: "Internet Unavailable – nema interneta", type: "info", retryable: true },
  "1100": { desc: "Storage 90% Full – skladište puno, vrijeme za audit", type: "warning", retryable: true },
  "1300": { desc: "Smart Card is not present – kartica/BE nije u čitaču", type: "warning", retryable: true },
  "1400": { desc: "Audit Required – iznos 75% limita, potreban audit", type: "warning", retryable: true },
  "1500": { desc: "Pin Code Required – unesite PIN na uređaju", type: "warning", retryable: true },
  "1999": { desc: "Undefined Warning", type: "warning", retryable: true },
  "2100": { desc: "Pin Not OK – pogrešan PIN", type: "error", retryable: true },
  "2110": { desc: "Card Locked – prekoračen broj PIN pokušaja, kartica zaključana", type: "error", retryable: false },
  "2210": { desc: "SE Locked – Secure Element zaključan, potreban audit", type: "error", retryable: true },
  "2220": { desc: "SE Communication Failed – uređaj ne može spojiti SE", type: "error", retryable: true },
  "2230": { desc: "SE Protocol Mismatch", type: "error", retryable: true },
  "2310": { desc: "Invalid tax labels – PDV oznake nisu definirane na uređaju", type: "error", retryable: true },
  "2400": { desc: "Not configured – uređaj nije potpuno konfiguriran (porezi, verification URL)", type: "error", retryable: true },
  "2800": { desc: "Field Required – obavezno polje nedostaje", type: "error", retryable: true },
  "2801": { desc: "Field Value Too Long – polje predugo", type: "error", retryable: true },
  "2802": { desc: "Field Value Too Short – polje prekratko", type: "error", retryable: true },
  "2803": { desc: "Invalid Field Length – dužina polja nije u očekivanom rasponu", type: "error", retryable: true },
  "2804": { desc: "Field Out Of Range – vrijednost izvan dozvoljenog raspona", type: "error", retryable: true },
  "2805": { desc: "Invalid Field Value – neispravna vrijednost (npr. Invoice Type, Transaction Type, Payment Type)", type: "error", retryable: true },
  "2806": { desc: "Invalid Data Format – neispravan format podataka", type: "error", retryable: true },
  "2807": { desc: "List Too Short – stavke ili labels prazni", type: "error", retryable: true },
  "2808": { desc: "List Too Long – previše stavki ili prevelik payload", type: "error", retryable: true },
  "2809": { desc: "Secure Element Expired – certifikat na kartici istekao", type: "error", retryable: false },
  "2811": { desc: "Invalid Invoice Type (obsolete, use 2805)", type: "error", retryable: true },
  "2812": { desc: "Invalid Transaction Type (obsolete, use 2805)", type: "error", retryable: true },
  "2813": { desc: "Invalid Payment Type (obsolete, use 2805)", type: "error", retryable: true },
  "2814": { desc: "BuyerId length exceeded (max 20 chars)", type: "error", retryable: true },
  "2815": { desc: "BuyerCostCenterId length exceeded (max 15)", type: "error", retryable: true },
  "2816": { desc: "POSInvoiceNumber length exceeded (max 20)", type: "error", retryable: true },
  "2817": { desc: "GTIN length invalid (8–14 chars)", type: "error", retryable: true },
  "2818": { desc: "Name length exceeded (max 2048)", type: "error", retryable: true },
  "2819": { desc: "Item name is required", type: "error", retryable: true },
  "2820": { desc: "Labels length exceeded", type: "error", retryable: true },
};

function parseFiscalError(
  text: string | null | undefined,
  data: any,
): null | { code: string; hint: string; retryable?: boolean } {
  const codeFromData =
    data?.code != null
      ? String(data.code).trim()
      : data?.statusCode != null
        ? String(data.statusCode).trim()
        : null;
  const textStr = text ? String(text).trim() : "";
  let code: string | null = null;
  if (codeFromData && /^\d{4}$/.test(codeFromData)) code = codeFromData;
  else if (codeFromData) {
    const m = codeFromData.match(/\b(\d{4})\b/);
    if (m) code = m[1];
  }
  if (!code && textStr) {
    const m = textStr.match(/\b(\d{4})\b/);
    if (m) code = m[1];
    else if (/^\d{4}$/.test(textStr)) code = textStr;
  }
  if (!code) return null;
  const entry = FISCAL_STATUS_CODES[code];
  const hint = entry ? `${code}: ${entry.desc}` : `${code}: (nepoznat kod)`;
  return {
    code,
    hint,
    retryable: entry?.retryable,
  };
}

function getTaxLabel(rate: number, script: "latin" | "cyrillic") {
  // PU spec: labels su stringovi. OFS/ESIR zahtijeva ĆIRILIČNO Е i К (drugi kodni broj od latinice E/K).
  // PDV 17%: Е = U+0415 (Cyrillic Capital Letter Ie), 0%: К = U+041A (Cyrillic Capital Letter Ka).
  if (rate > 0) return script === "latin" ? "E" : "\u0415"; // Е
  return script === "latin" ? "K" : "\u041A"; // К
}

/** Placeholder GTIN kad nema barkoda. OFS: 8–14 znakova; neki uređaji odbijaju 14 nula, probaj 8. */
const GTIN_PLACEHOLDER_14 = "00000000000000";
const GTIN_PLACEHOLDER_8 = "00000000";

/** Stavke za InvoiceRequest. PU spec: Item ima SAMO gtin, name, quantity, unitPrice, totalAmount, labels.
 * Ne dodavati polja koja nisu u spec-u (npr. discount, discountAmount) – PU odbija nepoznata polja. */
function buildInvoiceItems(body: Body, script: "latin" | "cyrillic", gtinPlaceholder: string = GTIN_PLACEHOLDER_14) {
  const discountNet = Number(body.discountNet ?? 0) || 0;

  // Fluxa stavke su osnovica (bez PDV-a). Uređaj očekuje bruto; label izvodi PDV.
  const items: Array<{ gtin: string; name: string; quantity: number; unitPrice: number; totalAmount: number; labels: string[] }> = (body.items || []).map((it) => {
    const rate = Number(it.vatRate || 0) / 100;
    const unitNet = Number(it.unitPrice) ?? 0;
    const totalNet = Number(it.totalAmount) ?? 0;
    const unitGross = round2(unitNet * (1 + rate));
    const totalGross = round2(totalNet * (1 + rate));
    return {
      gtin: gtinPlaceholder,
      name: String(it.name || "").slice(0, 2048),
      quantity: Math.max(0.001, Number(it.quantity) || 1),
      unitPrice: unitGross,
      totalAmount: totalGross,
      labels: [getTaxLabel(rate, script)],
    };
  });

  // Popust: jedina dozvoljena metoda u spec-u je dodatna stavka s negativnim iznosom (ista polja kao Item).
  if (discountNet > 0 && items.length > 0) {
    const first = items[0];
    const isE = Array.isArray(first.labels) && (first.labels.includes("\u0415") || first.labels.includes("E"));
    const discountRate = isE ? 0.17 : 0;
    const discountGross = round2(discountNet * (1 + discountRate));
    if (discountGross > 0) {
      items.push({
        gtin: gtinPlaceholder,
        name: "Popust",
        quantity: 1,
        unitPrice: -discountGross,
        totalAmount: -discountGross,
        labels: [getTaxLabel(discountRate, script)],
      });
    }
  }

  return items;
}

/** buyerId za uređaj: samo JIB (13 cifara). "VP:" + cifre za formate koji traže prefix; inače samo cifre. */
function normalizeBuyerId(body: Body) {
  const buyerTaxIdRaw = body.buyerTaxId != null ? String(body.buyerTaxId).trim() : "";
  const digits = buyerTaxIdRaw.replace(/[^\d]/g, "").slice(0, 13);
  if (digits.length !== 13) return "";
  return digits;
}

/** Za formate koji traže "VP:" + cifre (max 17 cifara u specu). */
function normalizeBuyerIdWithPrefix(body: Body) {
  const digits = normalizeBuyerId(body);
  return digits ? `VP:${digits}` : "";
}

/** Službeni PU spec: direktan InvoiceRequest. Šaljemo SAMO polja iz spec-a (bez discount/discountAmount na stavkama). */
function buildDirectInvoiceRequestV3(
  body: Body,
  script: "latin" | "cyrillic",
) {
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000+01:00`
      : new Date().toISOString();
  const items = buildInvoiceItems(body, script);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerId = normalizeBuyerIdWithPrefix(body);
  const invoiceNumber =
    body.invoiceNumber != null && Number.isFinite(Number(body.invoiceNumber))
      ? Number(body.invoiceNumber)
      : undefined;

  const invoiceType = body.training ? "Training" : "Normal";
  const req: Record<string, unknown> = {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    invoiceType,
    transactionType: "Sale",
    payment: [{ amount: paymentAmount, paymentType: "WireTransfer" as const }],
    items,
    options: {
      omitQRCodeGen: "0",
      omitTextualRepresentation: "0",
    },
  };
  if (buyerId) req.buyerId = buyerId;
  if (invoiceNumber !== undefined) req.invoiceNumber = invoiceNumber;
  return req;
}

/** Wrapper s "Request" (IRN primjer): { Request: { invoiceRequest, print } }. */
function buildRequestWrapperLPR(body: Body) {
  const script: "latin" | "cyrillic" = body.labelsScript || "cyrillic";
  const invoiceRequest = buildDirectInvoiceRequestV3(body, script);
  return {
    Request: {
      invoiceRequest,
      print: true,
    },
  };
}

/** Radeov primjer: { Request: { invoiceRequest } }. Bez dateAndTimeOfIssue, bez cashier. buyerId "VP:"+cifre. Stavke s discount: null, discountAmount: null. */
function buildRadeFormatBody(body: Body) {
  const script: "latin" | "cyrillic" = body.labelsScript || "cyrillic";
  const itemsBase = buildInvoiceItems(body, script);
  const items = itemsBase.map((it) => ({
    ...it,
    discount: null as null,
    discountAmount: null as null,
  }));
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerId = normalizeBuyerIdWithPrefix(body);
  const invoiceNumberRaw =
    body.invoiceNumber != null && Number.isFinite(Number(body.invoiceNumber))
      ? Number(body.invoiceNumber)
      : null;
  const invoiceType = body.training ? "Training" : "Normal";
  const invoiceRequest: Record<string, unknown> = {
    invoiceType,
    transactionType: "Sale",
    invoiceNumber: invoiceNumberRaw != null && invoiceNumberRaw > 0 ? invoiceNumberRaw : 1,
    payment: [{ amount: paymentAmount, paymentType: "WireTransfer" }],
    items,
  };
  if (buyerId) invoiceRequest.buyerId = buyerId;
  return { request: { invoiceRequest } };
}

/** Teron/Esir/OFS (port 3566): { invoiceRequest, print }. buyerId = samo JIB (13 cifara). Za INO 13×9. */
function buildInvoicePrintBody(body: Body, options?: { useLatinLabels?: boolean; omitInvoiceNumber?: boolean; omitBuyerId?: boolean; gtin8?: boolean }) {
  // OFS/ESIR zahtijeva ĆIRILIČNO Е (U+0415) i К (U+041A) – latinično E/K (drugi kod) može izazvati 400.
  const script: "latin" | "cyrillic" = options?.useLatinLabels ? "latin" : (body.labelsScript || "cyrillic");
  const gtin = options?.gtin8 ? GTIN_PLACEHOLDER_8 : GTIN_PLACEHOLDER_14;
  const rawItems = buildInvoiceItems(body, script, gtin);
  // Ne dodavati discount/discountAmount na stavke – dio uređaja ih ne prihvata (400). Popust = posebna stavka s negativnim iznosom.
  const items = rawItems;
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerIdDigits = normalizeBuyerId(body);
  const invoiceNumberRaw =
    body.invoiceNumber != null && Number.isFinite(Number(body.invoiceNumber))
      ? Number(body.invoiceNumber)
      : null;
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000+01:00`
      : new Date().toISOString();
  const invoiceType = body.training ? "Training" : "Normal";
  const invoiceRequest: Record<string, unknown> = {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    invoiceType,
    transactionType: "Sale",
    payment: [{ amount: paymentAmount, paymentType: "WireTransfer" }],
    items,
  };
  // Broj računa šaljemo SAMO kad ga imamo (nakon "Kreiraj račun"). Inače ne dodajemo polje – uređaj sam dodjeljuje.
  if (!options?.omitInvoiceNumber && invoiceNumberRaw != null && invoiceNumberRaw > 0) {
    invoiceRequest.invoiceNumber = invoiceNumberRaw;
  }
  if (buyerIdDigits && !options?.omitBuyerId) invoiceRequest.buyerId = buyerIdDigits;
  return {
    invoiceRequest,
    print: false,
  };
}

function buildInvoiceRequestV3(body: Body) {
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000Z`
      : new Date().toISOString();

  const script: "latin" | "cyrillic" = body.labelsScript || "cyrillic";
  const items = buildInvoiceItems(body, script);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerId = normalizeBuyerIdWithPrefix(body);
  const invoiceNumber =
    body.invoiceNumber != null && Number.isFinite(Number(body.invoiceNumber))
      ? Number(body.invoiceNumber)
      : 0;

  const invoiceType = body.training ? "Training" : "Normal";
  const invoiceRequest: any = {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    ...(buyerId ? { buyerId } : {}),
    invoiceType,
    transactionType: "Sale",
    invoiceNumber: invoiceNumber || null,
    items,
    payment: [{ amount: paymentAmount, paymentType: "WireTransfer" }],
  };
  return invoiceRequest;
}

function buildInvoiceRequestApiInvoices(body: Body) {
  const dateAndTimeOfIssue =
    body.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
      ? `${body.dateISO}T12:00:00.000Z`
      : new Date().toISOString();

  const script: "latin" | "cyrillic" = body.labelsScript || "cyrillic";
  const items = buildInvoiceItems(body, script);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  const buyerId = normalizeBuyerIdWithPrefix(body);

  return {
    dateAndTimeOfIssue,
    cashier: "Prodavac 1",
    ...(buyerId ? { buyerId } : {}),
    ...(buyerId ? { buyerCostCenterId: `T-${buyerId}` } : {}),
    invoiceNumber: null,
    invoiceType: body.training ? 3 : 0,
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
  const script: "latin" | "cyrillic" = body.labelsScript || "cyrillic";
  const items = buildInvoiceItems(body, script);
  const paymentAmount = round2(
    items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0),
  );
  return {
    cashier: "Prodavac 1",
    invoiceType: body.training ? 3 : 0,
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

    // PU zahtijeva isključivo JIB (13 cifara); PIB (12) uzrokuje 400. INO = 13×9.
    if (body.buyerTaxId != null && String(body.buyerTaxId).trim() !== "") {
      const digits = String(body.buyerTaxId).replace(/[^\d]/g, "").slice(0, 13);
      if (digits.length === 12) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "ID kupca mora biti JIB (13 cifara), ne PIB (12). Za INO kupce koristite 13 devetki (9999999999999).",
          },
          { status: 400 },
        );
      }
    }

    // Testni uređaj / Training račun: Rade preporučuje latinično E (ne ćirilično Е) – inače 400.
    const primaryScript: "latin" | "cyrillic" = body.training
      ? "latin"
      : (body.labelsScript || "cyrillic");
    const altScript: "latin" | "cyrillic" = primaryScript === "cyrillic" ? "latin" : "cyrillic";

    const base = baseUrl.replace(/\/$/, "");
    const baseWithScheme =
      /^https?:\/\//i.test(base) ? base : `http://${base}`;
    const url = `${baseWithScheme}${apiPath}`;

    const normalizedPath = apiPath.toLowerCase();
    const isApiInvoices =
      normalizedPath === "/api/invoices" || normalizedPath.endsWith("/api/invoices");
    const isApiV3Invoices =
      normalizedPath === "/api/v3/invoices" || normalizedPath.endsWith("/api/v3/invoices");

    // Port 3566 /api/invoices: { invoiceRequest, print }. Testni uređaj = latinično E/K; produkcija može ćirilica. GTIN 8. Broj računa samo kad front pošalje.
    const invoicePrintBodyOptions = {
      gtin8: true,
      ...(body.training ? { useLatinLabels: true } : {}),
    };
    const requestBodyPrimary = isApiV3Invoices
      ? buildDirectInvoiceRequestV3(body, primaryScript)
      : isApiInvoices
        ? buildInvoicePrintBody(body, invoicePrintBodyOptions)
        : buildInvoiceRequestV3(body);

    // Headers prema službenom spec-u: Accept, Content-Type, RequestId (max 32), Accept-Language.
    const requestId = `req-${Date.now().toString(36)}`.slice(0, 32);
    const acceptLanguage = (body.acceptLanguage || "sr;en").slice(0, 64);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      RequestId: requestId,
      "Accept-Language": acceptLanguage,
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

    // Pokušaj #1: službeni format (direktan InvoiceRequest za v3) ili stari format
    let { r: res, t: text, j: data } = await postOnce(url, requestBodyPrimary);

    // Za /api/invoices: ako 400, redom probaj (1) direktno /api/v3/invoices s wrapperom, (2) bez invoiceNumber, (3) GTIN 8, (4) bez buyerId. Zadržavamo latin/cyrillic iz primarnog pokušaja.
    if (isApiInvoices && res.status === 400 && !res.ok) {
      const code = parseFiscalError(text, data);
      if (!code?.code) {
        const wrapperPayload = (opts?: Parameters<typeof buildInvoicePrintBody>[1]) =>
          buildInvoicePrintBody(body, { ...invoicePrintBodyOptions, ...opts });
        const v3Url = `${baseWithScheme}/api/v3/invoices`;

        const attempts = [
          () => postOnce(v3Url, wrapperPayload()),
          () => postOnce(v3Url, wrapperPayload({ omitInvoiceNumber: true })),
          () => postOnce(v3Url, wrapperPayload({ gtin8: true })),
          () => postOnce(v3Url, wrapperPayload({ omitInvoiceNumber: true, omitBuyerId: true })),
        ];
        for (const attempt of attempts) {
          const ret = await attempt();
          if (ret.r.ok) {
            res = ret.r;
            text = ret.t;
            data = ret.j;
            break;
          }
        }
      }
    }

    // Ako v3 s direktnim bodyjem vrati 400/500, jedan put probaj s wrapperom (nekad uređaj/proxy to očekuje)
    if (
      isApiV3Invoices &&
      (res.status === 400 || res.status === 500) &&
      !res.ok
    ) {
      const wrapperBody = buildRequestWrapperLPR(body);
      const retry = await postOnce(url, wrapperBody);
      if (retry.r.ok) {
        res = retry.r;
        text = retry.t;
        data = retry.j;
      }
    }

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      const code = parseFiscalError(text, data);

      // Ako dobijemo 2310 Invalid tax labels, pokušaj jednom sa drugim scriptom (latinica ⇄ ćirilica).
      if (isApiV3Invoices && code?.code === "2310") {
        const retryBody = buildDirectInvoiceRequestV3(body, altScript);
        const retry = await postOnce(url, retryBody);
        if (retry.r.ok) {
          res = retry.r;
          text = retry.t;
          data = retry.j;
        }
      }

      if (res.ok) {
        // nastavi ka uspješnom parsiranju ispod
      } else {
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
          parsedCode: parseFiscalError(st, null),
        };
      } catch {
        statusProbe = null;
      }

      // Pokušaj #2 (samo kad #1 padne): isti invoiceRequest kao #1, ali u punom wrapperu
      // (email, receiptHeaderTextLines, receiptFooterTextLines) – možda uređaj očekuje taj oblik.
      let attempt2: any = null;
      try {
        if (isApiInvoices) {
          const { invoiceRequest } = buildInvoicePrintBody(body);
          const fullWrapperBody = buildInvoicePrintRequest(invoiceRequest);
          const r2 = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(fullWrapperBody),
            signal: AbortSignal.timeout(30000),
          });
          const t2 = await r2.text();
          attempt2 = {
            status: r2.status,
            contentType: r2.headers.get("content-type") || null,
            body: t2 ? t2.slice(0, 300) : null,
            parsedCode: parseFiscalError(t2, null),
            sentBody: fullWrapperBody,
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
      const retryable =
        code?.retryable ?? (res.status >= 500 ? true : undefined);
      return NextResponse.json(
        {
          ok: false,
          error: `Fiskalni uređaj: ${res.status} ${errMsg}${detail}`,
          fiscalCode: code?.code,
          fiscalCodeHint: code?.hint,
          retryable,
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
    }

    // Odgovor: može biti { Request, Response } (Response string ili objekt), ili direktan objekt.
    const rawResponse = data?.Response;
    const isResponseString =
      typeof rawResponse === "string" &&
      (rawResponse.includes("dostupan") || rawResponse.includes("nije dostupan"));
    if (isResponseString) {
      return NextResponse.json(
        {
          ok: false,
          error: `Fiskalni uređaj: ${rawResponse}`,
          url,
        },
        { status: 502 },
      );
    }
    // Printer error: fiskalizacija uspjela, podaci u invoiceResponse
    const payload =
      rawResponse &&
      typeof rawResponse === "object" &&
      Number(rawResponse.statusCode) === -2 &&
      rawResponse.invoiceResponse
        ? rawResponse.invoiceResponse
        : typeof rawResponse === "object" && (rawResponse.invoiceNumber != null || rawResponse.totalCounter != null)
          ? rawResponse
          : data;

    const totalCounter =
      payload?.totalCounter != null ? Number(payload.totalCounter) : null;
    return NextResponse.json({
      ok: true,
      verificationQRCode:
        payload?.verificationQrCode ?? payload?.verificationQRCode ?? null,
      sdcDateTime: payload?.sdcDateTime ?? null,
      invoiceNumber: payload?.invoiceNumber ?? null,
      invoiceCounter: payload?.invoiceCounter ?? null,
      invoiceCounterExtension: payload?.invoiceCounterExtension ?? null,
      totalCounter: Number.isFinite(totalCounter) ? totalCounter : null,
      transactionTypeCounter: payload?.transactionTypeCounter ?? null,
      verificationUrl: payload?.verificationUrl ?? null,
      journal: payload?.journal ?? null,
      printerError:
        rawResponse?.statusCode === -2
          ? rawResponse?.message ?? "Printer error"
          : undefined,
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
