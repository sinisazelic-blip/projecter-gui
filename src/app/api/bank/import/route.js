import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// ---------- helpers ----------
function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

/**
 * Parsira brojeve u raznim formatima:
 * - "1.234,56"  -> 1234.56
 * - "1234,56"   -> 1234.56
 * - "1234.56"   -> 1234.56
 * - "922.47"    -> 922.47  (VAŽNO: ne smije postati 92247)
 * - "92247"     -> 92247
 */
function toDecimal(str) {
  const raw = normText(str);
  if (!raw) return null;

  // i '.' i ',' -> '.' hiljadarski, ',' decimalni
  if (raw.includes(".") && raw.includes(",")) {
    const s = raw.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // samo ',' -> ',' decimalni
  if (raw.includes(",") && !raw.includes(".")) {
    const s = raw.replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // samo '.' -> ako izgleda kao decimalni (npr 922.47), koristi kao decimalni
  if (raw.includes(".") && !raw.includes(",")) {
    if (/^-?\d+\.\d{2}$/.test(raw)) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    // inače tretiraj '.' kao hiljadarski separator
    const s = raw.replace(/\./g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // samo cifre / minus
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function sha1Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseXml(xmlStr) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: true,
    parseAttributeValue: true,
  });
  return parser.parse(xmlStr);
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null) continue;
    return String(v).trim();
  }
  return "";
}

// datum u UniCredit G_* je dd.mm.yy (npr 08.01.26)
function normDate2(d) {
  const s = (d ?? "").toString().trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  const m2 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m3) return s;
  return null;
}

function first(x) {
  if (!x) return null;
  return Array.isArray(x) ? x[0] : x;
}

/**
 * UniCredit XML_2 (G_* shema) putanja:
 * IZVOD_KOM_KM_UPP / LIST_G_4 / G_4 / LIST_G_2 / G_2 / LIST_G_3 / G_3 / LIST_G_1 / G_1
 */
function findTransactions(parsed) {
  const root = parsed?.IZVOD_KOM_KM_UPP ?? parsed;

  const g4container = first(root?.LIST_G_4);
  const g4 = g4container?.G_4 ?? root?.LIST_G_4?.G_4 ?? g4container;

  const g2container = first(g4?.LIST_G_2);
  const g2 = g2container?.G_2 ?? g4?.LIST_G_2?.G_2 ?? g2container;

  const g3container = first(g2?.LIST_G_3);
  const g3 = g3container?.G_3 ?? g2?.LIST_G_3?.G_3 ?? g3container;

  const g1container = g3?.LIST_G_1;
  const tx = g1container?.G_1;

  if (Array.isArray(tx)) return tx;
  if (tx && typeof tx === "object") return [tx];
  return [];
}

// ---------- route ----------
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nedostaje file." }, { status: 400 });
    }
    if (typeof file === "string") {
      return NextResponse.json({ error: "Neispravan file." }, { status: 400 });
    }

    const xmlStr = await file.text();

    const parsed = parseXml(xmlStr);
    const txnNodes = findTransactions(parsed);

    if (!txnNodes.length) {
      return NextResponse.json(
        { error: "Nisam našao transakcije u XML_2 (UniCredit G_* shema)." },
        { status: 400 },
      );
    }

    let inserted = 0;
    let skipped = 0;
    const sample = [];

    for (const node of txnNodes) {
      const booking_date = normDate2(pick(node, ["DATUM_VALUTE"]));
      const value_date = booking_date;

      if (!booking_date) continue;

      const rawDug = pick(node, ["IZNOS_DUGUJE"]) || "";
      const rawPot = pick(node, ["IZNOS_POTRAZUJE"]) || "";

      const dug = toDecimal(rawDug) || 0;
      const pot = toDecimal(rawPot) || 0;

      // prilivi +, odlivi -
      const amountValue = pot - dug;

      // Ako su oba 0 i nema smisla, preskoči (čisto da ne puniš šum)
      if (amountValue === 0 && !rawDug && !rawPot) continue;

      const counterpartyName = pick(node, ["KOME"]) || null;
      const counterpartyAccount = null;
      const description = pick(node, ["SVRHA", "CF_SVRHA"]) || null;
      const reference = null;

      // --- VAŽNO: jedinstven bank_txn_id, da ne guta proviziju ---
      // Ako BROJ postoji, vežemo ga uz datum (i prefix UC) da bude stabilno jedinstveno
      // Ako ne postoji, hash uključuje i sirove iznose + opis
      const broj = pick(node, ["BROJ"]) || "";

      const uniqPart = await sha1Hex(
        `UC|${booking_date}|${amountValue}|${counterpartyName || ""}|${description || ""}|${rawDug}|${rawPot}`,
      );

      // ograniči dužinu (tvoja kolona je varchar(100))
      const bankTxnId = broj
        ? `UC:${booking_date}:${broj}:${uniqPart.slice(0, 16)}`
        : `UC:${booking_date}:${uniqPart.slice(0, 24)}`;
      const descUpper = (description || "").toUpperCase();
      const isOwner = descUpper.includes("POSUDBA VLASNIKA");

      const counterparty_type = isOwner ? "VLASNIK" : "OSTALO";
      const is_internal_transfer = isOwner ? 1 : 0;

      const res = await query(
        `
        INSERT INTO bank_transakcije
          (bank_txn_id, booking_date, value_date, amount, currency,
           counterparty_name, counterparty_account, description, reference,
           counterparty_type, is_internal_transfer, raw_payload)
        VALUES
          (?, ?, ?, ?, 'BAM',
           ?, ?, ?, ?,
           ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          bank_txn_id = bank_txn_id
        `,
        [
          bankTxnId,
          booking_date,
          value_date,
          amountValue,
          counterpartyName,
          counterpartyAccount,
          description,
          reference,
          counterparty_type,
          is_internal_transfer,
          xmlStr,
        ],
      );

      if (res?.affectedRows === 1) inserted++;
      else skipped++;

      if (sample.length < 5) {
        sample.push({
          booking_date,
          amount: amountValue,
          counterpartyName,
          description,
          counterparty_type,
        });
      }
    }

    return NextResponse.json({ ok: true, inserted, skipped, sample });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Greška pri importu." },
      { status: 500 },
    );
  }
}
