import { query, withTransaction } from "@/lib/db";
import {
  ensureOpsTables,
  type OpsArtikal,
  type OpsArtikalVrsta,
  type OpsJedinicaOpreme,
  type OpsJm,
  type OpsMagacin,
  type OpsJedinicaZivot,
  type OpsKlasaRizika,
  type OpsKompletacija,
  type OpsKompletacijaStavka,
  type OpsPovratStanje,
  type OpsRadniNalog,
  type OpsSastavnicaLinija,
  type OpsStanje,
} from "@/lib/ops/schema";

export async function listOpsCatalog() {
  await ensureOpsTables();
  const jedinice = await query<OpsJm>(
    `SELECT jm_id, oznaka, naziv FROM ops_jedinice ORDER BY jm_id ASC`,
  );
  const magacini = await query<OpsMagacin>(
    `SELECT magacin_id, kod, naziv, vrsta FROM ops_magacini ORDER BY magacin_id ASC`,
  );
  const artikli = await query<OpsArtikal>(
    `SELECT a.artikal_id, a.sifra, a.naziv, a.vrsta, a.jm_id, j.oznaka AS jm_oznaka,
            a.default_magacin_id, m.kod AS magacin_kod, a.aktivan
     FROM ops_artikli a
     JOIN ops_jedinice j ON j.jm_id = a.jm_id
     JOIN ops_magacini m ON m.magacin_id = a.default_magacin_id
     ORDER BY a.vrsta ASC, a.sifra ASC`,
  );
  const stanje = await query<OpsStanje>(
    `SELECT s.magacin_id, s.artikal_id, s.kolicina,
            a.sifra, a.naziv, j.oznaka AS jm_oznaka, m.kod AS magacin_kod
     FROM ops_stanje s
     JOIN ops_artikli a ON a.artikal_id = s.artikal_id
     JOIN ops_jedinice j ON j.jm_id = a.jm_id
     JOIN ops_magacini m ON m.magacin_id = s.magacin_id
     WHERE s.kolicina <> 0
     ORDER BY m.kod ASC, a.sifra ASC`,
  );
  const jediniceOpreme = await query<OpsJedinicaOpreme>(
    `SELECT e.jedinica_id, e.kod, e.artikal_id, e.magacin_id, e.stanje, e.rn_id,
            e.kompletacija_id, e.teski_eventi, a.sifra
     FROM ops_jedinice_opreme e
     JOIN ops_artikli a ON a.artikal_id = e.artikal_id
     ORDER BY e.jedinica_id DESC
     LIMIT 200`,
  );
  const sastavnice = await query<OpsSastavnicaLinija>(
    `SELECT s.sablon_artikal_id, s.komponenta_artikal_id, s.kolicina,
            k.sifra AS komponenta_sifra, k.naziv AS komponenta_naziv, j.oznaka AS komponenta_jm
     FROM ops_sastavnice s
     JOIN ops_artikli k ON k.artikal_id = s.komponenta_artikal_id
     JOIN ops_jedinice j ON j.jm_id = k.jm_id
     ORDER BY s.sablon_artikal_id ASC, k.sifra ASC`,
  );
  return {
    jedinice: jedinice ?? [],
    magacini: magacini ?? [],
    artikli: (artikli ?? []).map((a) => ({ ...a, aktivan: Number(a.aktivan) })),
    sastavnice: (sastavnice ?? []).map((s) => ({
      ...s,
      kolicina: Number(s.kolicina),
    })),
    stanje: (stanje ?? []).map((s) => ({ ...s, kolicina: Number(s.kolicina) })),
    jediniceOpreme: jediniceOpreme ?? [],
  };
}

export type OpsPrijemnica = {
  prijemnica_id: number;
  broj: string;
  datum: string;
  dobavljac_naziv: string | null;
  racun: string | null;
};

export async function listOpsPrijemnice(): Promise<OpsPrijemnica[]> {
  await ensureOpsTables();
  const rows = await query<OpsPrijemnica>(
    `SELECT prijemnica_id, broj, datum, dobavljac_naziv, racun
     FROM ops_prijemnice
     ORDER BY prijemnica_id DESC
     LIMIT 80`,
  );
  return rows ?? [];
}

export async function listOpsDobavljaci(): Promise<
  Array<{ dobavljac_id: number; naziv: string }>
> {
  try {
    const rows = await query<{ dobavljac_id: number; naziv: string }>(
      `SELECT dobavljac_id, naziv FROM dobavljaci WHERE aktivan = 1 ORDER BY naziv ASC LIMIT 400`,
    );
    return rows ?? [];
  } catch {
    return [];
  }
}

async function nextPrijemnicaBroj(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;
  const [rows] = (await conn.query(
    `SELECT broj FROM ops_prijemnice WHERE broj LIKE ? ORDER BY prijemnica_id DESC LIMIT 1`,
    [`${prefix}%`],
  )) as [{ broj: string }[]];
  const last = String(rows?.[0]?.broj ?? "");
  const n = Number(last.slice(prefix.length)) || 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

function formatOpremaKod(artikalSifra: string, n: number) {
  return `${artikalSifra}-${String(n).padStart(6, "0")}`;
}

export async function createOpsPrijemnica(input: {
  datum: string;
  dobavljac_id?: number | null;
  dobavljac_naziv?: string | null;
  racun?: string | null;
  napomena?: string | null;
  lines: Array<{ artikal_id: number; kolicina: number }>;
}): Promise<{ broj: string; serije: string[] }> {
  await ensureOpsTables();
  const datum = String(input.datum ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error("DATUM_REQUIRED");
  const lines = (input.lines ?? []).filter((l) => Number(l.kolicina) > 0);
  if (!lines.length) throw new Error("STAVKE_REQUIRED");

  const artikli = await query<OpsArtikal>(
    `SELECT artikal_id, sifra, naziv, vrsta, jm_id, default_magacin_id, aktivan
     FROM ops_artikli`,
  );
  const byId = new Map((artikli ?? []).map((a) => [a.artikal_id, a]));
  const serije: string[] = [];
  let broj = "";

  await withTransaction(async (conn) => {
    broj = await nextPrijemnicaBroj(conn);
    await conn.query(
      `INSERT INTO ops_prijemnice (broj, datum, dobavljac_id, dobavljac_naziv, racun, napomena)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        broj,
        datum,
        input.dobavljac_id || null,
        String(input.dobavljac_naziv ?? "").trim() || null,
        String(input.racun ?? "").trim() || null,
        String(input.napomena ?? "").trim() || null,
      ],
    );
    const [hdr] = await conn.query(
      `SELECT prijemnica_id FROM ops_prijemnice WHERE broj = ? LIMIT 1`,
      [broj],
    );
    const prijemnicaId = Number(
      (Array.isArray(hdr) ? (hdr[0] as { prijemnica_id: number })?.prijemnica_id : 0) ||
        0,
    );
    if (!prijemnicaId) throw new Error("PRIJEMNICA_INSERT");

    for (const line of lines) {
      const art = byId.get(Number(line.artikal_id));
      if (!art || !art.aktivan) throw new Error("ARTIKAL_INVALID");
      if (art.vrsta === "SABLON") throw new Error("SABLON_NIJE_PRIJEM");
      const qty = Number(line.kolicina);
      await conn.query(
        `INSERT INTO ops_prijemnica_stavke (prijemnica_id, artikal_id, magacin_id, kolicina)
         VALUES (?, ?, ?, ?)`,
        [prijemnicaId, art.artikal_id, art.default_magacin_id, qty],
      );

      if (art.vrsta === "OPREMA") {
        if (Math.abs(qty - Math.round(qty)) > 1e-9) {
          throw new Error("OPREMA_CIJELI_KOMADI");
        }
        const [cntRows] = await conn.query(
          `SELECT COUNT(*) AS c FROM ops_jedinice_opreme WHERE artikal_id = ?`,
          [art.artikal_id],
        );
        let n = Number(
          (Array.isArray(cntRows) ? (cntRows[0] as { c: number })?.c : 0) || 0,
        );
        const count = Math.round(qty);
        for (let i = 0; i < count; i++) {
          n += 1;
          const kod = formatOpremaKod(art.sifra, n);
          serije.push(kod);
          await conn.query(
            `INSERT INTO ops_jedinice_opreme (kod, artikal_id, magacin_id, prijemnica_id, stanje)
             VALUES (?, ?, ?, ?, 'U_MAGACINU')`,
            [kod, art.artikal_id, art.default_magacin_id, prijemnicaId],
          );
        }
      } else {
        await conn.query(
          `INSERT INTO ops_stanje (magacin_id, artikal_id, kolicina)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE kolicina = kolicina + VALUES(kolicina)`,
          [art.default_magacin_id, art.artikal_id, qty],
        );
      }
    }
  });

  return { broj, serije };
}

export async function createOpsArtikal(input: {
  sifra: string;
  naziv: string;
  vrsta: OpsArtikalVrsta;
  jm_id: number;
  default_magacin_id?: number;
}): Promise<number> {
  await ensureOpsTables();
  const sifra = String(input.sifra ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
  const naziv = String(input.naziv ?? "").trim();
  const vrsta = input.vrsta;
  if (!sifra || !naziv) throw new Error("SIFRA_NAZIV_REQUIRED");
  if (!["MATERIJAL", "OPREMA", "SABLON"].includes(vrsta)) {
    throw new Error("VRSTA_INVALID");
  }
  if (!Number(input.jm_id)) throw new Error("JM_REQUIRED");
  const magacini = await query<OpsMagacin>(
    `SELECT magacin_id, kod, naziv, vrsta FROM ops_magacini`,
  );
  const m1 = (magacini ?? []).find((m) => m.kod === "M1");
  const m2 = (magacini ?? []).find((m) => m.kod === "M2");
  const magId =
    input.default_magacin_id ||
    (vrsta === "MATERIJAL" ? m1?.magacin_id : m2?.magacin_id);
  if (!magId) throw new Error("MAGACIN_REQUIRED");
  await query(
    `INSERT INTO ops_artikli (sifra, naziv, vrsta, jm_id, default_magacin_id, aktivan)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [sifra, naziv, vrsta, Number(input.jm_id), magId],
  );
  const row = await query<{ artikal_id: number }>(
    `SELECT artikal_id FROM ops_artikli WHERE sifra = ? LIMIT 1`,
    [sifra],
  );
  return Number(row?.[0]?.artikal_id ?? 0);
}

export async function updateOpsArtikal(
  id: number,
  input: Partial<{
    naziv: string;
    vrsta: OpsArtikalVrsta;
    jm_id: number;
    default_magacin_id: number;
    aktivan: number;
  }>,
): Promise<void> {
  await ensureOpsTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.naziv != null) {
    sets.push("naziv = ?");
    vals.push(String(input.naziv).trim());
  }
  if (input.vrsta != null) {
    sets.push("vrsta = ?");
    vals.push(input.vrsta);
  }
  if (input.jm_id != null) {
    sets.push("jm_id = ?");
    vals.push(Number(input.jm_id));
  }
  if (input.default_magacin_id != null) {
    sets.push("default_magacin_id = ?");
    vals.push(Number(input.default_magacin_id));
  }
  if (input.aktivan != null) {
    sets.push("aktivan = ?");
    vals.push(Number(input.aktivan) ? 1 : 0);
  }
  if (!sets.length) return;
  vals.push(id);
  await query(`UPDATE ops_artikli SET ${sets.join(", ")} WHERE artikal_id = ?`, vals);
}

export async function replaceOpsSastavnica(
  sablonId: number,
  lines: Array<{ komponenta_artikal_id: number; kolicina: number }>,
): Promise<void> {
  await ensureOpsTables();
  const sablon = await query<{ vrsta: string }>(
    `SELECT vrsta FROM ops_artikli WHERE artikal_id = ? LIMIT 1`,
    [sablonId],
  );
  if (String(sablon?.[0]?.vrsta ?? "") !== "SABLON") {
    throw new Error("NOT_SABLON");
  }
  await query(`DELETE FROM ops_sastavnice WHERE sablon_artikal_id = ?`, [sablonId]);
  for (const line of lines) {
    const kid = Number(line.komponenta_artikal_id);
    const qty = Number(line.kolicina);
    if (!kid || kid === sablonId || !(qty > 0)) continue;
    await query(
      `INSERT INTO ops_sastavnice (sablon_artikal_id, komponenta_artikal_id, kolicina)
       VALUES (?, ?, ?)`,
      [sablonId, kid, qty],
    );
  }
}

export async function listOpsRadnici(): Promise<
  Array<{ radnik_id: number; naziv: string }>
> {
  try {
    const rows = await query<{ radnik_id: number; ime: string; prezime: string }>(
      `SELECT radnik_id, ime, prezime FROM radnici WHERE aktivan = 1 ORDER BY ime, prezime ASC LIMIT 400`,
    );
    return (rows ?? []).map((r) => ({
      radnik_id: r.radnik_id,
      naziv: `${r.ime ?? ""} ${r.prezime ?? ""}`.trim(),
    }));
  } catch {
    return [];
  }
}

export async function listOpsRadniNalozi(): Promise<OpsRadniNalog[]> {
  await ensureOpsTables();
  const rows = await query<OpsRadniNalog>(
    `SELECT r.rn_id, r.broj, r.datum, r.sablon_artikal_id, a.sifra AS sablon_sifra,
            a.naziv AS sablon_naziv, r.kolicina, r.sati, r.radnik_naziv, r.napomena
     FROM ops_radni_nalozi r
     JOIN ops_artikli a ON a.artikal_id = r.sablon_artikal_id
     ORDER BY r.rn_id DESC
     LIMIT 80`,
  );
  const serije = await query<{ rn_id: number; kod: string; artikal_id: number }>(
    `SELECT e.rn_id, e.kod, e.artikal_id
     FROM ops_jedinice_opreme e
     WHERE e.rn_id IS NOT NULL
     ORDER BY e.jedinica_id ASC`,
  );
  const byRn = new Map<number, string[]>();
  for (const s of serije ?? []) {
    const row = (rows ?? []).find((r) => r.rn_id === s.rn_id);
    if (!row || s.artikal_id !== row.sablon_artikal_id) continue;
    const list = byRn.get(s.rn_id) ?? [];
    list.push(s.kod);
    byRn.set(s.rn_id, list);
  }
  return (rows ?? []).map((r) => ({
    ...r,
    kolicina: Number(r.kolicina),
    sati: r.sati == null ? null : Number(r.sati),
    serije: byRn.get(r.rn_id) ?? [],
  }));
}

async function nextRnBroj(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RN-${year}-`;
  const [rows] = (await conn.query(
    `SELECT broj FROM ops_radni_nalozi WHERE broj LIKE ? ORDER BY rn_id DESC LIMIT 1`,
    [`${prefix}%`],
  )) as [{ broj: string }[]];
  const last = String(rows?.[0]?.broj ?? "");
  const n = Number(last.slice(prefix.length)) || 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

export async function createOpsRadniNalog(input: {
  datum: string;
  sablon_artikal_id: number;
  kolicina: number;
  sati?: number | null;
  radnik_id?: number | null;
  radnik_naziv?: string | null;
  napomena?: string | null;
}): Promise<{ broj: string; serije: string[] }> {
  await ensureOpsTables();
  const datum = String(input.datum ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error("DATUM_REQUIRED");
  const sablonId = Number(input.sablon_artikal_id);
  const qty = Number(input.kolicina);
  if (!sablonId) throw new Error("SABLON_REQUIRED");
  if (!Number.isInteger(qty) || qty < 1) throw new Error("KOLICINA_CIJELI");
  const closer = String(input.radnik_naziv ?? "").trim();
  if (!closer) throw new Error("KO_ZATVORIO");

  const sablon = await query<OpsArtikal>(
    `SELECT artikal_id, sifra, naziv, vrsta, jm_id, default_magacin_id, aktivan
     FROM ops_artikli WHERE artikal_id = ? LIMIT 1`,
    [sablonId],
  );
  const sablonArt = sablon?.[0];
  if (!sablonArt || sablonArt.vrsta !== "SABLON" || !sablonArt.aktivan) {
    throw new Error("SABLON_INVALID");
  }

  const bom = await query<{
    komponenta_artikal_id: number;
    kolicina: number;
    sifra: string;
    vrsta: string;
    default_magacin_id: number;
    jm_oznaka: string;
  }>(
    `SELECT s.komponenta_artikal_id, s.kolicina, k.sifra, k.vrsta,
            k.default_magacin_id, j.oznaka AS jm_oznaka
     FROM ops_sastavnice s
     JOIN ops_artikli k ON k.artikal_id = s.komponenta_artikal_id
     JOIN ops_jedinice j ON j.jm_id = k.jm_id
     WHERE s.sablon_artikal_id = ?`,
    [sablonId],
  );
  if (!bom?.length) throw new Error("BOM_REQUIRED");

  const serije: string[] = [];
  let broj = "";

  await withTransaction(async (conn) => {
    broj = await nextRnBroj(conn);
    const [ins] = (await conn.query(
      `INSERT INTO ops_radni_nalozi
         (broj, datum, sablon_artikal_id, kolicina, sati, radnik_id, radnik_naziv, napomena)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        broj,
        datum,
        sablonId,
        qty,
        input.sati != null && Number(input.sati) > 0 ? Number(input.sati) : null,
        input.radnik_id || null,
        closer,
        String(input.napomena ?? "").trim() || null,
      ],
    )) as [{ insertId?: number }];
    const rnId = Number(ins?.insertId ?? 0);
    if (!rnId) throw new Error("RN_INSERT");

    for (const line of bom) {
      if (line.vrsta === "SABLON") throw new Error("SABLON_NIJE_KOMPONENTA");
      const need = Number(line.kolicina) * qty;
      if (!(need > 0)) continue;

      if (line.vrsta === "OPREMA") {
        if (Math.abs(need - Math.round(need)) > 1e-9) {
          throw new Error("OPREMA_CIJELI_KOMADI");
        }
        const take = Math.round(need);
        const [units] = (await conn.query(
          `SELECT jedinica_id FROM ops_jedinice_opreme
           WHERE artikal_id = ? AND stanje = 'U_MAGACINU'
           ORDER BY jedinica_id ASC
           LIMIT ${take}
           FOR UPDATE`,
          [line.komponenta_artikal_id],
        )) as [{ jedinica_id: number }[]];
        if (!Array.isArray(units) || units.length < take) {
          throw new Error(
            `Nedostaje ${line.sifra}: treba ${take} kom, slobodno ${units?.length ?? 0}`,
          );
        }
        for (const u of units) {
          await conn.query(
            `UPDATE ops_jedinice_opreme
             SET stanje = 'UGRADJENO', rn_id = ?
             WHERE jedinica_id = ?`,
            [rnId, u.jedinica_id],
          );
        }
      } else {
        const [stockRows] = (await conn.query(
          `SELECT kolicina FROM ops_stanje
           WHERE magacin_id = ? AND artikal_id = ?
           FOR UPDATE`,
          [line.default_magacin_id, line.komponenta_artikal_id],
        )) as [{ kolicina: number }[]];
        const have = Number(stockRows?.[0]?.kolicina ?? 0);
        if (have + 1e-9 < need) {
          throw new Error(
            `Nedostaje ${line.sifra}: treba ${need} ${line.jm_oznaka}, na stanju ${have}`,
          );
        }
        const [upd] = (await conn.query(
          `UPDATE ops_stanje
           SET kolicina = kolicina - ?
           WHERE magacin_id = ? AND artikal_id = ? AND kolicina >= ?`,
          [need, line.default_magacin_id, line.komponenta_artikal_id, need],
        )) as [{ affectedRows?: number }];
        if (!Number(upd?.affectedRows)) {
          throw new Error(`Nedostaje ${line.sifra}: stanje se promijenilo`);
        }
      }

      await conn.query(
        `INSERT INTO ops_rn_potrosnja (rn_id, artikal_id, magacin_id, kolicina)
         VALUES (?, ?, ?, ?)`,
        [rnId, line.komponenta_artikal_id, line.default_magacin_id, need],
      );
    }

    const [cntRows] = (await conn.query(
      `SELECT COUNT(*) AS c FROM ops_jedinice_opreme WHERE artikal_id = ?`,
      [sablonId],
    )) as [{ c: number }[]];
    let n = Number(cntRows?.[0]?.c ?? 0);
    for (let i = 0; i < qty; i++) {
      n += 1;
      const kod = formatOpremaKod(sablonArt.sifra, n);
      serije.push(kod);
      await conn.query(
        `INSERT INTO ops_jedinice_opreme
           (kod, artikal_id, magacin_id, rn_id, stanje)
         VALUES (?, ?, ?, ?, 'U_MAGACINU')`,
        [kod, sablonId, sablonArt.default_magacin_id, rnId],
      );
    }
  });

  return { broj, serije };
}

export type OpsKlijentOption = {
  klijent_id: number;
  naziv: string;
  is_narucilac: number;
};

export type OpsProjekatOption = {
  projekat_id: number;
  naziv: string;
  narucilac_id: number | null;
  narucilac_naziv: string | null;
  krajnji_klijent_id: number | null;
  krajnji_naziv: string | null;
};

export async function listOpsKlijenti(): Promise<OpsKlijentOption[]> {
  try {
    const rows = await query<{
      klijent_id: number;
      naziv_klijenta: string;
      is_narucilac: number;
    }>(
      `SELECT klijent_id, naziv_klijenta, COALESCE(is_narucilac, 0) AS is_narucilac
       FROM klijenti
       WHERE COALESCE(aktivan, 1) = 1
       ORDER BY naziv_klijenta ASC
       LIMIT 400`,
    );
    return (rows ?? []).map((r) => ({
      klijent_id: r.klijent_id,
      naziv: r.naziv_klijenta,
      is_narucilac: Number(r.is_narucilac ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function assertOpsNarucilac(klijentId: number): Promise<{
  klijent_id: number;
  naziv: string;
}> {
  const id = Number(klijentId);
  if (!id) throw new Error("NARUCILAC_REQUIRED");
  const rows = await query<{ naziv_klijenta: string; is_narucilac: number }>(
    `SELECT naziv_klijenta, COALESCE(is_narucilac, 0) AS is_narucilac
     FROM klijenti WHERE klijent_id = ? LIMIT 1`,
    [id],
  );
  const row = rows?.[0];
  if (!row || Number(row.is_narucilac) !== 1) throw new Error("NARUCILAC_REQUIRED");
  return { klijent_id: id, naziv: row.naziv_klijenta };
}

export async function listOpsProjekti(): Promise<OpsProjekatOption[]> {
  try {
    const rows = await query<{
      projekat_id: number;
      radni_naziv: string;
      narucilac_id: number | null;
      narucilac_naziv: string | null;
      krajnji_klijent_id: number | null;
      krajnji_naziv: string | null;
    }>(
      `SELECT p.projekat_id, p.radni_naziv, p.narucilac_id, p.krajnji_klijent_id,
              kn.naziv_klijenta AS narucilac_naziv,
              kk.naziv_klijenta AS krajnji_naziv
       FROM projekti p
       LEFT JOIN klijenti kn ON kn.klijent_id = p.narucilac_id
       LEFT JOIN klijenti kk ON kk.klijent_id = p.krajnji_klijent_id
       ORDER BY p.projekat_id DESC
       LIMIT 200`,
    );
    return (rows ?? []).map((r) => ({
      projekat_id: r.projekat_id,
      naziv: r.radni_naziv || `#${r.projekat_id}`,
      narucilac_id: r.narucilac_id,
      narucilac_naziv: r.narucilac_naziv,
      krajnji_klijent_id: r.krajnji_klijent_id,
      krajnji_naziv: r.krajnji_naziv,
    }));
  } catch {
    return [];
  }
}

export async function listOpsKompletacije(): Promise<OpsKompletacija[]> {
  await ensureOpsTables();
  const rows = await query<OpsKompletacija>(
    `SELECT k.kompletacija_id, k.broj, k.event_naziv, k.klasa_rizika, k.projekat_id,
            k.klijent_id, k.klijent_naziv, k.krajnji_klijent_id, k.krajnji_klijent_naziv,
            k.objekat, k.status, k.faktura_id, k.created_at,
            (SELECT COUNT(*) FROM ops_kompletacija_stavke s
             WHERE s.kompletacija_id = k.kompletacija_id) AS jedinica_count
     FROM ops_kompletacije k
     ORDER BY k.kompletacija_id DESC
     LIMIT 80`,
  );
  return (rows ?? []).map((r) => ({
    ...r,
    jedinica_count: Number(r.jedinica_count ?? 0),
  }));
}

export async function listOpsKompletacijaStavke(
  kompletacijaId: number,
): Promise<OpsKompletacijaStavka[]> {
  await ensureOpsTables();
  const rows = await query<OpsKompletacijaStavka>(
    `SELECT s.stavka_id, s.kompletacija_id, s.jedinica_id, s.kod, a.sifra, s.faza,
            s.povrat_stanje, s.izdao_naziv, s.montaza_naziv, s.vratio_naziv
     FROM ops_kompletacija_stavke s
     JOIN ops_jedinice_opreme e ON e.jedinica_id = s.jedinica_id
     JOIN ops_artikli a ON a.artikal_id = e.artikal_id
     WHERE s.kompletacija_id = ?
     ORDER BY s.stavka_id ASC`,
    [kompletacijaId],
  );
  return rows ?? [];
}

export async function listOpsJedinicaZivot(
  jedinicaId: number,
): Promise<OpsJedinicaZivot[]> {
  await ensureOpsTables();
  const rows = await query<OpsJedinicaZivot>(
    `SELECT z.zivot_id, z.jedinica_id, z.kod, z.kompletacija_id, k.event_naziv,
            z.akcija, z.klasa_rizika, z.povrat_stanje, z.osoba, z.created_at
     FROM ops_jedinica_zivot z
     LEFT JOIN ops_kompletacije k ON k.kompletacija_id = z.kompletacija_id
     WHERE z.jedinica_id = ?
     ORDER BY z.zivot_id DESC
     LIMIT 80`,
    [jedinicaId],
  );
  return rows ?? [];
}

async function nextKompletacijaBroj(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `KE-${year}-`;
  const [rows] = (await conn.query(
    `SELECT broj FROM ops_kompletacije WHERE broj LIKE ? ORDER BY kompletacija_id DESC LIMIT 1`,
    [`${prefix}%`],
  )) as [{ broj: string }[]];
  const last = String(rows?.[0]?.broj ?? "");
  const n = Number(last.slice(prefix.length)) || 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

export async function createOpsKompletacija(input: {
  event_naziv: string;
  klasa_rizika: OpsKlasaRizika;
  projekat_id?: number | null;
  klijent_id?: number | null;
  klijent_naziv?: string | null;
  krajnji_klijent_id?: number | null;
  krajnji_klijent_naziv?: string | null;
  objekat?: string | null;
}): Promise<{ broj: string; kompletacija_id: number }> {
  await ensureOpsTables();
  const event = String(input.event_naziv ?? "").trim();
  if (!event) throw new Error("EVENT_REQUIRED");
  const klasa = input.klasa_rizika;
  if (!["POZORISTE", "STADION", "OSTALO"].includes(klasa)) {
    throw new Error("KLASA_REQUIRED");
  }

  let narucilacId = input.klijent_id ? Number(input.klijent_id) : null;
  let narucilacNaziv = String(input.klijent_naziv ?? "").trim() || null;
  let krajnjiId = input.krajnji_klijent_id
    ? Number(input.krajnji_klijent_id)
    : null;
  let krajnjiNaziv = String(input.krajnji_klijent_naziv ?? "").trim() || null;
  let objekat = String(input.objekat ?? "").trim() || null;

  if (input.projekat_id) {
    const jobs = await listOpsProjekti();
    const job = jobs.find((p) => p.projekat_id === Number(input.projekat_id));
    if (job) {
      if (!narucilacId && job.narucilac_id) {
        narucilacId = job.narucilac_id;
        narucilacNaziv = job.narucilac_naziv;
      }
      if (!krajnjiId && job.krajnji_klijent_id) {
        krajnjiId = job.krajnji_klijent_id;
        krajnjiNaziv = job.krajnji_naziv;
      }
      if (!objekat && job.krajnji_naziv) objekat = job.krajnji_naziv;
    }
  }

  if (narucilacId) {
    const n = await assertOpsNarucilac(narucilacId);
    narucilacNaziv = n.naziv;
  }
  if (krajnjiId && !krajnjiNaziv) {
    const rows = await query<{ naziv_klijenta: string }>(
      `SELECT naziv_klijenta FROM klijenti WHERE klijent_id = ? LIMIT 1`,
      [krajnjiId],
    );
    krajnjiNaziv = rows?.[0]?.naziv_klijenta ?? null;
  }

  let broj = "";
  let kompletacijaId = 0;
  await withTransaction(async (conn) => {
    broj = await nextKompletacijaBroj(conn);
    const [ins] = (await conn.query(
      `INSERT INTO ops_kompletacije
         (broj, event_naziv, klasa_rizika, projekat_id, klijent_id, klijent_naziv,
          krajnji_klijent_id, krajnji_klijent_naziv, objekat, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OTVOREN')`,
      [
        broj,
        event,
        klasa,
        input.projekat_id || null,
        narucilacId,
        narucilacNaziv,
        krajnjiId,
        krajnjiNaziv,
        objekat,
      ],
    )) as [{ insertId?: number }];
    kompletacijaId = Number(ins?.insertId ?? 0);
    if (!kompletacijaId) throw new Error("KOMPLETACIJA_INSERT");
  });
  return { broj, kompletacija_id: kompletacijaId };
}

async function refreshKompletacijaStatus(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  kompletacijaId: number,
) {
  const [rows] = (await conn.query(
    `SELECT faza FROM ops_kompletacija_stavke WHERE kompletacija_id = ?`,
    [kompletacijaId],
  )) as [{ faza: string }[]];
  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter((r) => r.faza !== "VRACENO");
  let status = "OTVOREN";
  if (!list.length) status = "OTVOREN";
  else if (!active.length) status = "ZATVOREN";
  else if (active.some((r) => r.faza === "MONTAZA")) status = "U_MONTAZI";
  else status = "OTVOREN";
  await conn.query(
    `UPDATE ops_kompletacije SET status = ? WHERE kompletacija_id = ?`,
    [status, kompletacijaId],
  );
}

export async function skenOpsJedinica(input: {
  kod: string;
  akcija: "IZDATO" | "MONTAZA" | "POVRAT" | "SERVIS_GOTOVO";
  kompletacija_id?: number | null;
  osoba: string;
  povrat_stanje?: OpsPovratStanje | null;
}): Promise<{
  jedinica: OpsJedinicaOpreme;
  zivot: OpsJedinicaZivot[];
}> {
  await ensureOpsTables();
  const kod = String(input.kod ?? "").trim().toUpperCase();
  const osoba = String(input.osoba ?? "").trim();
  if (!kod) throw new Error("KOD_REQUIRED");
  if (!osoba) throw new Error("OSOBA_REQUIRED");
  const akcija = input.akcija;

  await withTransaction(async (conn) => {
    const [units] = (await conn.query(
      `SELECT jedinica_id, kod, artikal_id, magacin_id, stanje, rn_id,
              kompletacija_id, teski_eventi
       FROM ops_jedinice_opreme
       WHERE UPPER(kod) = ?
       FOR UPDATE`,
      [kod],
    )) as [OpsJedinicaOpreme[]];
    const unit = Array.isArray(units) ? units[0] : null;
    if (!unit) throw new Error("KOD_NOT_FOUND");
    if (unit.stanje === "UGRADJENO") throw new Error("UGRADJENO_NIJE_SKEN");
    if (unit.stanje === "OTPIS") throw new Error("OTPIS_ZATVOREN");

    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace("T", " ");

    if (akcija === "SERVIS_GOTOVO") {
      if (unit.stanje !== "SERVIS") throw new Error("NIJE_U_SERVISU");
      await conn.query(
        `UPDATE ops_jedinice_opreme
         SET stanje = 'U_MAGACINU', kompletacija_id = NULL
         WHERE jedinica_id = ?`,
        [unit.jedinica_id],
      );
      await conn.query(
        `INSERT INTO ops_jedinica_zivot
           (jedinica_id, kod, kompletacija_id, akcija, osoba, napomena)
         VALUES (?, ?, NULL, 'SERVIS_GOTOVO', ?, 'Povrat iz servisa u M2')`,
        [unit.jedinica_id, unit.kod, osoba],
      );
      return;
    }

    const kid =
      Number(input.kompletacija_id || unit.kompletacija_id || 0) || 0;

    if (akcija === "IZDATO") {
      if (unit.stanje !== "U_MAGACINU") throw new Error("NIJE_U_MAGACINU");
      if (!kid) throw new Error("KOMPLETACIJA_REQUIRED");
      const [hdr] = (await conn.query(
        `SELECT kompletacija_id, klasa_rizika, status
         FROM ops_kompletacije WHERE kompletacija_id = ? FOR UPDATE`,
        [kid],
      )) as [{ kompletacija_id: number; klasa_rizika: string; status: string }[]];
      const ev = Array.isArray(hdr) ? hdr[0] : null;
      if (!ev) throw new Error("KOMPLETACIJA_INVALID");
      if (ev.status === "ZATVOREN") throw new Error("KOMPLETACIJA_ZATVORENA");
      await conn.query(
        `UPDATE ops_jedinice_opreme
         SET stanje = 'IZDATO', kompletacija_id = ?
         WHERE jedinica_id = ?`,
        [kid, unit.jedinica_id],
      );
      await conn.query(
        `INSERT INTO ops_kompletacija_stavke
           (kompletacija_id, jedinica_id, kod, faza, izdao_naziv, izdao_at)
         VALUES (?, ?, ?, 'IZDATO', ?, ?)
         ON DUPLICATE KEY UPDATE faza = 'IZDATO', izdao_naziv = VALUES(izdao_naziv),
           izdao_at = VALUES(izdao_at), povrat_stanje = NULL`,
        [kid, unit.jedinica_id, unit.kod, osoba, stamp],
      );
      await conn.query(
        `INSERT INTO ops_jedinica_zivot
           (jedinica_id, kod, kompletacija_id, akcija, klasa_rizika, osoba)
         VALUES (?, ?, ?, 'IZDATO', ?, ?)`,
        [unit.jedinica_id, unit.kod, kid, ev.klasa_rizika, osoba],
      );
      await refreshKompletacijaStatus(conn, kid);
      return;
    }

    if (!unit.kompletacija_id) throw new Error("NIJE_NA_EVENTU");
    const eventId = Number(unit.kompletacija_id);
    const [hdr] = (await conn.query(
      `SELECT kompletacija_id, klasa_rizika, status
       FROM ops_kompletacije WHERE kompletacija_id = ? FOR UPDATE`,
      [eventId],
    )) as [{ kompletacija_id: number; klasa_rizika: string; status: string }[]];
    const ev = Array.isArray(hdr) ? hdr[0] : null;
    if (!ev) throw new Error("KOMPLETACIJA_INVALID");

    if (akcija === "MONTAZA") {
      if (unit.stanje !== "IZDATO") throw new Error("NIJE_IZDATO");
      await conn.query(
        `UPDATE ops_jedinice_opreme SET stanje = 'MONTAZA' WHERE jedinica_id = ?`,
        [unit.jedinica_id],
      );
      await conn.query(
        `UPDATE ops_kompletacija_stavke
         SET faza = 'MONTAZA', montaza_naziv = ?, montaza_at = ?
         WHERE kompletacija_id = ? AND jedinica_id = ?`,
        [osoba, stamp, eventId, unit.jedinica_id],
      );
      await conn.query(
        `INSERT INTO ops_jedinica_zivot
           (jedinica_id, kod, kompletacija_id, akcija, klasa_rizika, osoba)
         VALUES (?, ?, ?, 'MONTAZA', ?, ?)`,
        [unit.jedinica_id, unit.kod, eventId, ev.klasa_rizika, osoba],
      );
      await refreshKompletacijaStatus(conn, eventId);
      return;
    }

    if (akcija === "POVRAT") {
      if (unit.stanje !== "MONTAZA" && unit.stanje !== "IZDATO") {
        throw new Error("NIJE_NA_TERENU");
      }
      const stanje = input.povrat_stanje;
      if (!stanje || !["ISPRAVAN", "OSTECEN", "SERVIS", "OTPIS"].includes(stanje)) {
        throw new Error("POVRAT_STANJE");
      }
      const nextStanje =
        stanje === "ISPRAVAN"
          ? "U_MAGACINU"
          : stanje === "OTPIS"
            ? "OTPIS"
            : "SERVIS";
      const teski =
        ev.klasa_rizika === "STADION" ? Number(unit.teski_eventi ?? 0) + 1 : null;
      await conn.query(
        teski != null
          ? `UPDATE ops_jedinice_opreme
             SET stanje = ?, kompletacija_id = NULL, teski_eventi = ?
             WHERE jedinica_id = ?`
          : `UPDATE ops_jedinice_opreme
             SET stanje = ?, kompletacija_id = NULL
             WHERE jedinica_id = ?`,
        teski != null
          ? [nextStanje, teski, unit.jedinica_id]
          : [nextStanje, unit.jedinica_id],
      );
      await conn.query(
        `UPDATE ops_kompletacija_stavke
         SET faza = 'VRACENO', povrat_stanje = ?, vratio_naziv = ?, vratio_at = ?
         WHERE kompletacija_id = ? AND jedinica_id = ?`,
        [stanje, osoba, stamp, eventId, unit.jedinica_id],
      );
      await conn.query(
        `INSERT INTO ops_jedinica_zivot
           (jedinica_id, kod, kompletacija_id, akcija, klasa_rizika, povrat_stanje, osoba)
         VALUES (?, ?, ?, 'POVRAT', ?, ?, ?)`,
        [unit.jedinica_id, unit.kod, eventId, ev.klasa_rizika, stanje, osoba],
      );
      await refreshKompletacijaStatus(conn, eventId);
      return;
    }

    throw new Error("AKCIJA_INVALID");
  });

  const jedinicaRows = await query<OpsJedinicaOpreme>(
    `SELECT e.jedinica_id, e.kod, e.artikal_id, e.magacin_id, e.stanje, e.rn_id,
            e.kompletacija_id, e.teski_eventi, a.sifra
     FROM ops_jedinice_opreme e
     JOIN ops_artikli a ON a.artikal_id = e.artikal_id
     WHERE UPPER(e.kod) = ?
     LIMIT 1`,
    [kod],
  );
  const jedinica = jedinicaRows?.[0];
  if (!jedinica) throw new Error("KOD_NOT_FOUND");
  const zivot = await listOpsJedinicaZivot(jedinica.jedinica_id);
  return {
    jedinica: { ...jedinica, teski_eventi: Number(jedinica.teski_eventi ?? 0) },
    zivot,
  };
}

export async function lookupOpsJedinica(kodRaw: string): Promise<{
  jedinica: OpsJedinicaOpreme;
  zivot: OpsJedinicaZivot[];
} | null> {
  await ensureOpsTables();
  const kod = String(kodRaw ?? "").trim().toUpperCase();
  if (!kod) return null;
  const rows = await query<OpsJedinicaOpreme>(
    `SELECT e.jedinica_id, e.kod, e.artikal_id, e.magacin_id, e.stanje, e.rn_id,
            e.kompletacija_id, e.teski_eventi, a.sifra
     FROM ops_jedinice_opreme e
     JOIN ops_artikli a ON a.artikal_id = e.artikal_id
     WHERE UPPER(e.kod) = ?
     LIMIT 1`,
    [kod],
  );
  const jedinica = rows?.[0];
  if (!jedinica) return null;
  const zivot = await listOpsJedinicaZivot(jedinica.jedinica_id);
  return {
    jedinica: { ...jedinica, teski_eventi: Number(jedinica.teski_eventi ?? 0) },
    zivot,
  };
}
