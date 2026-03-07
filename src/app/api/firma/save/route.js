// src/app/api/firma/save/route.js
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

function clean(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function hasAnyBankField(b) {
  return Boolean(b.bank_naziv || b.bank_racun || b.iban || b.swift);
}

export async function POST(req) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "Bad form data" },
      { status: 400 },
    );
  }

  const naziv = clean(form.get("naziv"));
  if (!naziv) {
    return NextResponse.json(
      { ok: false, error: "Naziv je obavezan" },
      { status: 400 },
    );
  }

  const payload = {
    naziv,
    pravni_naziv: clean(form.get("pravni_naziv")),
    adresa: clean(form.get("adresa")),
    grad: clean(form.get("grad")),
    postanski_broj: clean(form.get("postanski_broj")),
    drzava: clean(form.get("drzava")),

    telefon: clean(form.get("telefon")),
    email: clean(form.get("email")),
    web: clean(form.get("web")),

    jib: clean(form.get("jib")),
    pib: clean(form.get("pib")),
    pdv_broj: clean(form.get("pdv_broj")),
    broj_rjesenja: clean(form.get("broj_rjesenja")),
    vat_rate_local: form.get("vat_rate_local") !== null && form.get("vat_rate_local") !== "" ? Number(form.get("vat_rate_local")) : null,

    logo_path: clean(form.get("logo_path")),
  };

  // ✅ računi (max 3 za sada)
  const banks = [1, 2, 3].map((i) => ({
    idx: i,
    bank_naziv: clean(form.get(`bank_naziv_${i}`)),
    bank_racun: clean(form.get(`bank_racun_${i}`)),
    iban: clean(form.get(`iban_${i}`)),
    swift: clean(form.get(`swift_${i}`)),
  }));

  const banksFilled = banks.filter((b) => hasAnyBankField(b));

  // ✅ glavni račun (radio)
  const primaryIdxRaw =
    clean(form.get("primary_idx")) ||
    clean(form.get("primary_idx_default")) ||
    "1";
  const primaryIdx = Number(primaryIdxRaw) || 1;

  // Ako nema nijedan račun popunjen, nećemo fail-ati (nekad firma još nema unesen račun),
  // ali čim bude makar jedan — mora postojati tačno jedan glavni (radio to već garantuje).
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) deaktiviraj postojeći aktivni (nema brisanja)
    await conn.query(
      `UPDATE firma_profile SET is_active = 0 WHERE is_active = 1`,
    );

    // 2) insert novi aktivni profil
    const [ins] = await conn.query(
      `
      INSERT INTO firma_profile (
        is_active,
        naziv, pravni_naziv,
        adresa, grad, postanski_broj, drzava,
        telefon, email, web,
        jib, pib, pdv_broj, broj_rjesenja,
        vat_rate_local,
        logo_path,

        bank_naziv, bank_racun, swift, iban
      ) VALUES (
        1,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?,
        NULL, NULL, NULL, NULL
      )
      `,
      [
        payload.naziv,
        payload.pravni_naziv,

        payload.adresa,
        payload.grad,
        payload.postanski_broj,
        payload.drzava,

        payload.telefon,
        payload.email,
        payload.web,

        payload.jib,
        payload.pib,
        payload.pdv_broj,
        payload.broj_rjesenja,
        payload.vat_rate_local,

        payload.logo_path,
      ],
    );

    const firmaId = ins?.insertId;
    if (!firmaId) throw new Error("Insert firma_profile failed (no insertId)");

    // 3) upiši bank račune (N), i tačno jednom dodijeli primary_rank=1
    //    (UNIQUE(firma_id, primary_rank) će nas zaštititi od greške ako se desi duplikat)
    let primarySet = false;

    for (const b of banksFilled) {
      const isPrimary = Number(b.idx) === Number(primaryIdx) && !primarySet;

      await conn.query(
        `
        INSERT INTO firma_bank_accounts (
          firma_id, bank_naziv, bank_racun, iban, swift, primary_rank
        ) VALUES (
          ?, ?, ?, ?, ?, ?
        )
        `,
        [
          firmaId,
          b.bank_naziv,
          b.bank_racun,
          b.iban,
          b.swift,
          isPrimary ? 1 : null,
        ],
      );

      if (isPrimary) primarySet = true;
    }

    // Ako ima računa, a glavni nije upisan (npr. radio izabrao praznu sekciju),
    // automatski postavi prvi uneseni kao glavni.
    if (banksFilled.length > 0 && !primarySet) {
      await conn.query(
        `
        UPDATE firma_bank_accounts
        SET primary_rank = 1
        WHERE firma_id = ?
        ORDER BY bank_account_id ASC
        LIMIT 1
        `,
        [firmaId],
      );
    }

    await conn.commit();

    const url = new URL("/studio/firma?saved=1", req.url);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  } finally {
    conn.release();
  }
}
