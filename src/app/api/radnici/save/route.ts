import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function toBit(v: any): 0 | 1 {
  return v ? 1 : 0;
}

async function getRadniciColumns(): Promise<Set<string>> {
  const rows: any[] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'radnici'
        AND COLUMN_NAME IN ('adresa','broj_telefona','telefon','email','datum_rodjenja','jib','aktivan','opis')`,
  );
  return new Set((rows ?? []).map((r) => String(r.COLUMN_NAME).toLowerCase()));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const colSet = await getRadniciColumns();
    const hasAdresa = colSet.has("adresa");
    const hasBrojTelefona = colSet.has("broj_telefona");
    const hasTelefon = colSet.has("telefon");
    const hasEmail = colSet.has("email");
    const hasDatumRodjenja = colSet.has("datum_rodjenja");
    const hasJib = colSet.has("jib");
    const hasAktivan = colSet.has("aktivan");
    const hasOpis = colSet.has("opis");

    const ime = String(body?.ime ?? "").trim();
    if (!ime) {
      return NextResponse.json(
        { ok: false, error: "Ime je obavezno." },
        { status: 400 },
      );
    }
    const prezime = String(body?.prezime ?? "").trim();
    if (!prezime) {
      return NextResponse.json(
        { ok: false, error: "Prezime je obavezno." },
        { status: 400 },
      );
    }

    const telCol = hasBrojTelefona ? "broj_telefona" : hasTelefon ? "telefon" : null;
    const telVal = cleanStr(body?.broj_telefona);

    // Datum: osiguraj YYYY-MM-DD format ili null
    const datumRaw = body?.datum_rodjenja;
    let datumVal: string | null = null;
    if (datumRaw && typeof datumRaw === "string") {
      const m = datumRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) datumVal = `${m[1]}-${m[2]}-${m[3]}`;
    }

    const radnik_id = body?.radnik_id ? Number(body.radnik_id) : null;

    if (radnik_id && Number.isFinite(radnik_id) && radnik_id > 0) {
      // UPDATE
      const sets: string[] = ["ime=?", "prezime=?"];
      const vals: any[] = [ime, prezime];

      if (hasAdresa) {
        sets.push("adresa=?");
        vals.push(cleanStr(body?.adresa));
      }
      if (telCol) {
        sets.push(`${telCol}=?`);
        vals.push(telVal);
      }
      if (hasEmail) {
        sets.push("email=?");
        vals.push(cleanStr(body?.email));
      }
      if (hasDatumRodjenja) {
        sets.push("datum_rodjenja=CAST(? AS DATE)");
        vals.push(datumVal ?? null);
      }
      if (hasJib) {
        sets.push("jib=?");
        vals.push(cleanStr(body?.jib));
      }
      if (hasAktivan) {
        sets.push("aktivan=?");
        vals.push(toBit(body?.aktivan));
      }
      if (hasOpis) {
        sets.push("opis=?");
        vals.push(cleanStr(body?.opis));
      }

      vals.push(radnik_id);
      const updateSql = `UPDATE radnici SET ${sets.join(", ")} WHERE radnik_id=?`;
      await query(updateSql, vals);
    } else {
      // INSERT
      const cols: string[] = ["ime", "prezime"];
      const vals: any[] = [ime, prezime];

      if (hasAdresa) {
        cols.push("adresa");
        vals.push(cleanStr(body?.adresa));
      }
      if (telCol) {
        cols.push(telCol);
        vals.push(telVal);
      }
      if (hasEmail) {
        cols.push("email");
        vals.push(cleanStr(body?.email));
      }
      if (hasDatumRodjenja) {
        cols.push("datum_rodjenja");
        vals.push(datumVal ?? null);
      }
      if (hasJib) {
        cols.push("jib");
        vals.push(cleanStr(body?.jib));
      }
      if (hasAktivan) {
        cols.push("aktivan");
        vals.push(toBit(body?.aktivan));
      }
      if (hasOpis) {
        cols.push("opis");
        vals.push(cleanStr(body?.opis));
      }

      const placeholders = cols.map(() => "?").join(",");
      await query(
        `INSERT INTO radnici (${cols.join(", ")}) VALUES (${placeholders})`,
        vals,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Greška pri snimanju." },
      { status: 500 },
    );
  }
}
