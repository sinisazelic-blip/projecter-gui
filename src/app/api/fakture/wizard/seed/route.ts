import { NextResponse } from "next/server";
import crypto from "crypto";

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

function luhnCheckDigit(numStr: string): string {
  // numStr je niz cifara bez kontrolne
  let sum = 0;
  let dbl = true;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let d = Number(numStr[i]);
    if (dbl) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  const cd = (10 - (sum % 10)) % 10;
  return String(cd);
}

function hmacR3(salt: string, msg: string): number {
  const h = crypto.createHmac("sha256", salt).update(msg).digest("hex");
  // uzmi prvih 12 heks cifara => int (sigurno stane u Number)
  const head = h.slice(0, 12);
  const n = parseInt(head, 16);
  return n % 1000;
}

/**
 * Poziv na broj (8 cifara) = r3(3 cifre) + p4(4 cifre) + kontrolna(1 cifra)
 * r3 = HMAC_SHA256(SALT, SEED + ':' + key) % 1000
 * p4 = zadnje 4 cifre "anchor" (projekat)
 *
 * key: za 1 projekat = projekat_id
 *      za više projekata = "minId-maxId-count" (deterministički)
 */
function generatePoziv8(ids: number[]): string {
  const SALT = process.env.PB_SALT ?? "FLUXA_PB_SALT_DEV";
  const SEED = process.env.PB_SEED ?? "11";

  const clean = ids
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (clean.length === 0) return "00000000";

  const minId = clean[0];
  const maxId = clean[clean.length - 1];
  const key =
    clean.length === 1 ? String(minId) : `${minId}-${maxId}-${clean.length}`;

  const p4 = pad(minId % 10000, 4);
  const r3 = pad(hmacR3(SALT, `${SEED}:${key}`), 3);

  const base7 = `${r3}${p4}`;
  const cd = luhnCheckDigit(base7);
  return `${base7}${cd}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const idsRaw = String(searchParams.get("ids") ?? "");
    const ids = idsRaw
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const poziv_na_broj = generatePoziv8(ids);

    return NextResponse.json({ ok: true, ids, poziv_na_broj }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
