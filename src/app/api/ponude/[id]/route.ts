// GET: jedna ponuda sa stavkama i klijentom (za preview)
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { query } from "@/lib/db";

function asInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return x <= 0 ? null : x;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    const [rows]: any = await (pool as any).query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const id = asInt(idParam);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Nedostaje ili neispravan id ponude." },
        { status: 400 },
      );
    }

    const hasPopustKm = await hasColumn("ponude", "popust_km");
    const ponudeCols = hasPopustKm
      ? "p.ponuda_id, p.inicijacija_id, p.godina, p.broj_u_godini, CONCAT('P', LPAD(p.broj_u_godini, 3, '0'), '/', p.godina) AS broj_ponude, p.datum_izdavanja, p.datum_vazenja, p.klijent_id, p.valuta, p.popust_km, p.created_at"
      : "p.ponuda_id, p.inicijacija_id, p.godina, p.broj_u_godini, CONCAT('P', LPAD(p.broj_u_godini, 3, '0'), '/', p.godina) AS broj_ponude, p.datum_izdavanja, p.datum_vazenja, p.klijent_id, p.valuta, p.created_at";
    const ponudeRows = await query(
      `SELECT ${ponudeCols} FROM ponude p WHERE p.ponuda_id = ? LIMIT 1`,
      [id],
    );
    let ponuda: any =
      Array.isArray(ponudeRows) && ponudeRows.length ? ponudeRows[0] : null;
    if (ponuda && !hasPopustKm) ponuda = { ...ponuda, popust_km: null };
    if (!ponuda) {
      return NextResponse.json(
        { ok: false, error: "Ponuda nije pronađena." },
        { status: 404 },
      );
    }

    const stavkeRows = await query(
      `
      SELECT ponuda_stavka_id, naziv_snapshot, jedinica_snapshot,
             kolicina, cijena_jedinicna, valuta, opis, line_total
      FROM ponuda_stavke
      WHERE ponuda_id = ?
      ORDER BY ponuda_stavka_id ASC
      `,
      [id],
    );
    const stavke = Array.isArray(stavkeRows) ? stavkeRows : [];

    const klijentiHasIsIno = await hasColumn("klijenti", "is_ino");
    const klijentSql = klijentiHasIsIno
      ? `SELECT klijent_id, naziv_klijenta, adresa, grad, drzava, porezni_id, email, COALESCE(is_ino, 0) AS is_ino FROM klijenti WHERE klijent_id = ? LIMIT 1`
      : `SELECT klijent_id, naziv_klijenta, adresa, grad, drzava, porezni_id, email FROM klijenti WHERE klijent_id = ? LIMIT 1`;
    const klijentRows = await query(klijentSql, [(ponuda as any).klijent_id]);
    let klijent: any =
      Array.isArray(klijentRows) && klijentRows.length ? klijentRows[0] : null;
    if (klijent && !klijentiHasIsIno) klijent = { ...klijent, is_ino: 0 };

    // Firma (aktivni profil) za zaglavlje preview-a
    const firmaProfileRows = await query(
      `SELECT firma_id, naziv, pravni_naziv, adresa, grad, drzava, pdv_broj, pib, jib, logo_path
       FROM firma_profile WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
    );
    let firma: any =
      Array.isArray(firmaProfileRows) && firmaProfileRows.length
        ? firmaProfileRows[0]
        : null;
    if (firma?.firma_id) {
      let accRows: any[] = [];
      try {
        accRows = await query(
          `SELECT bank_account_id, bank_naziv, bank_racun, iban, swift, show_on_invoice FROM firma_bank_accounts WHERE firma_id = ? AND COALESCE(show_on_invoice, 1) = 1 ORDER BY bank_account_id ASC`,
          [firma.firma_id],
        );
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (msg.includes("Unknown column") && msg.includes("show_on_invoice")) {
          accRows = await query(
            `SELECT bank_account_id, bank_naziv, bank_racun, iban, swift FROM firma_bank_accounts WHERE firma_id = ? ORDER BY bank_account_id ASC`,
            [firma.firma_id],
          );
        } else {
          throw e;
        }
      }
      firma = {
        ...firma,
        bank_accounts: Array.isArray(accRows) ? accRows : [],
      };
    }

    return NextResponse.json({
      ok: true,
      ponuda,
      stavke,
      klijent,
      firma,
    });
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (
      msg.includes("ponude") ||
      msg.includes("doesn't exist") ||
      msg.includes("Unknown table")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ponuda nije pronađena. (Tabela ponude možda nije kreirana.)",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: msg || "Greška (GET ponuda)" },
      { status: 500 },
    );
  }
}
