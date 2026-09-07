import { query, withTransaction } from "@/lib/db";
import {
  ensureOpsTables,
  type OpsArtikal,
  type OpsRdn,
  type OpsRnPosao,
  type OpsRnSpec,
} from "@/lib/ops/schema";
import { isRnPosaoOtvoren, type PrijemIzvor, type RdnVrsta } from "@/lib/ops/process";

async function nextBroj(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  table: "ops_nalozi_posla" | "ops_rdn",
  prefixBase: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${prefixBase}-${year}-`;
  const orderCol = table === "ops_rdn" ? "rdn_id" : "rn_posao_id";
  const [rows] = (await conn.query(
    `SELECT broj FROM ${table} WHERE broj LIKE ? ORDER BY ${orderCol} DESC LIMIT 1`,
    [`${prefix}%`],
  )) as unknown as [{ broj: string }[]];
  const last = String(rows?.[0]?.broj ?? "");
  const n = Number(last.slice(prefix.length)) || 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

function formatOpremaKod(artikalSifra: string, n: number) {
  return `${artikalSifra}-${String(n).padStart(6, "0")}`;
}

export async function listOpsNaloziPosla(projekatId?: number): Promise<
  Array<OpsRnPosao & { spec: OpsRnSpec[]; saas: string[] }>
> {
  await ensureOpsTables();
  const params: number[] = [];
  let where = "";
  if (projekatId && projekatId > 0) {
    where = "WHERE r.projekat_id = ?";
    params.push(projekatId);
  }
  const rows = await query<OpsRnPosao>(
    `SELECT r.rn_posao_id, r.broj, r.projekat_id, p.radni_naziv AS projekat_naziv,
            r.datum, r.objekat, r.voditelj_naziv, r.datum_od, r.datum_do,
            r.status, r.napomena
     FROM ops_nalozi_posla r
     LEFT JOIN projekti p ON p.projekat_id = r.projekat_id
     ${where}
     ORDER BY r.rn_posao_id DESC
     LIMIT 120`,
    params,
  );
  const ids = (rows ?? []).map((r) => r.rn_posao_id);
  const specBy = new Map<number, OpsRnSpec[]>();
  const saasBy = new Map<number, string[]>();
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const spec = await query<OpsRnSpec>(
      `SELECT s.spec_id, s.rn_posao_id, s.artikal_id, s.kolicina,
              a.sifra, a.naziv
       FROM ops_nalog_posla_spec s
       JOIN ops_artikli a ON a.artikal_id = s.artikal_id
       WHERE s.rn_posao_id IN (${ph})
       ORDER BY s.spec_id ASC`,
      ids,
    );
    for (const s of spec ?? []) {
      const list = specBy.get(s.rn_posao_id) ?? [];
      list.push({ ...s, kolicina: Number(s.kolicina) });
      specBy.set(s.rn_posao_id, list);
    }
    const saas = await query<{ rn_posao_id: number; modul_key: string }>(
      `SELECT rn_posao_id, modul_key FROM ops_nalog_posla_saas
       WHERE rn_posao_id IN (${ph})`,
      ids,
    );
    for (const m of saas ?? []) {
      const list = saasBy.get(m.rn_posao_id) ?? [];
      list.push(m.modul_key);
      saasBy.set(m.rn_posao_id, list);
    }
  }
  return (rows ?? []).map((r) => ({
    ...r,
    spec: specBy.get(r.rn_posao_id) ?? [],
    saas: saasBy.get(r.rn_posao_id) ?? [],
  }));
}

export async function createOpsNalogPosla(input: {
  projekat_id: number;
  datum: string;
  objekat?: string | null;
  voditelj_naziv?: string | null;
  datum_od?: string | null;
  datum_do?: string | null;
  napomena?: string | null;
  spec?: Array<{ artikal_id: number; kolicina: number }>;
  saas?: string[];
}): Promise<{ broj: string; rn_posao_id: number }> {
  await ensureOpsTables();
  const projekatId = Number(input.projekat_id);
  if (!projekatId) throw new Error("PROJEKAT_REQUIRED");
  const proj = await query<{ projekat_id: number }>(
    `SELECT projekat_id FROM projekti WHERE projekat_id = ? LIMIT 1`,
    [projekatId],
  );
  if (!proj?.[0]) throw new Error("PROJEKAT_INVALID");
  const datum = String(input.datum ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error("DATUM_REQUIRED");

  let broj = "";
  let rnId = 0;
  await withTransaction(async (conn) => {
    broj = await nextBroj(conn, "ops_nalozi_posla", "RN");
    const [ins] = (await conn.query(
      `INSERT INTO ops_nalozi_posla
         (broj, projekat_id, datum, objekat, voditelj_naziv, datum_od, datum_do, status, napomena)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OTVOREN', ?)`,
      [
        broj,
        projekatId,
        datum,
        String(input.objekat ?? "").trim() || null,
        String(input.voditelj_naziv ?? "").trim() || null,
        input.datum_od && /^\d{4}-\d{2}-\d{2}$/.test(input.datum_od)
          ? input.datum_od
          : null,
        input.datum_do && /^\d{4}-\d{2}-\d{2}$/.test(input.datum_do)
          ? input.datum_do
          : null,
        String(input.napomena ?? "").trim() || null,
      ],
    )) as unknown as [{ insertId?: number }];
    rnId = Number(ins?.insertId ?? 0);
    if (!rnId) throw new Error("RN_INSERT");
    for (const line of input.spec ?? []) {
      const aid = Number(line.artikal_id);
      const qty = Math.round(Number(line.kolicina));
      if (!aid || qty < 1) continue;
      await conn.query(
        `INSERT INTO ops_nalog_posla_spec (rn_posao_id, artikal_id, kolicina)
         VALUES (?, ?, ?)`,
        [rnId, aid, qty],
      );
    }
    for (const key of input.saas ?? []) {
      const k = String(key ?? "").trim();
      if (!k) continue;
      await conn.query(
        `INSERT IGNORE INTO ops_nalog_posla_saas (rn_posao_id, modul_key) VALUES (?, ?)`,
        [rnId, k],
      );
    }
  });
  return { broj, rn_posao_id: rnId };
}

export async function getOpsNalogPosla(rnPosaoId: number) {
  const list = await listOpsNaloziPosla();
  return list.find((r) => r.rn_posao_id === rnPosaoId) ?? null;
}

export async function listOpenRnForProjekat(projekatId: number) {
  await ensureOpsTables();
  const rows = await query<{ rn_posao_id: number; broj: string; status: string }>(
    `SELECT rn_posao_id, broj, status FROM ops_nalozi_posla WHERE projekat_id = ?`,
    [projekatId],
  );
  return (rows ?? []).filter((r) => isRnPosaoOtvoren(r.status));
}

export async function assertRnSpecAllows(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  rnPosaoId: number,
  artikalId: number,
): Promise<void> {
  const [spec] = (await conn.query(
    `SELECT kolicina FROM ops_nalog_posla_spec
     WHERE rn_posao_id = ? AND artikal_id = ?`,
    [rnPosaoId, artikalId],
  )) as unknown as [{ kolicina: number }[]];
  const need = Number(spec?.[0]?.kolicina ?? 0);
  if (need < 1) throw new Error("NIJE_NA_SPEC_RN");
  const [taken] = (await conn.query(
    `SELECT COUNT(*) AS c FROM ops_jedinice_opreme
     WHERE rn_posao_id = ? AND artikal_id = ?
       AND stanje IN ('IZDATO','NA_TERENU','MONTAZA')`,
    [rnPosaoId, artikalId],
  )) as unknown as [{ c: number }[]];
  if (Number(taken?.[0]?.c ?? 0) >= need) throw new Error("SPEC_RN_PUN");
}

export async function listOpsRdn(): Promise<OpsRdn[]> {
  await ensureOpsTables();
  const rows = await query<OpsRdn>(
    `SELECT r.rdn_id, r.broj, r.vrsta, r.datum, r.sablon_artikal_id, a.sifra AS sablon_sifra,
            r.jedinica_id, e.kod AS jedinica_kod, r.kolicina, r.sati, r.radnik_naziv,
            r.status, r.napomena
     FROM ops_rdn r
     LEFT JOIN ops_artikli a ON a.artikal_id = r.sablon_artikal_id
     LEFT JOIN ops_jedinice_opreme e ON e.jedinica_id = r.jedinica_id
     ORDER BY r.rdn_id DESC
     LIMIT 80`,
  );
  const serije = await query<{ rdn_id: number; kod: string }>(
    `SELECT rdn_id, kod FROM ops_jedinice_opreme WHERE rdn_id IS NOT NULL`,
  );
  const by = new Map<number, string[]>();
  for (const s of serije ?? []) {
    const list = by.get(s.rdn_id) ?? [];
    list.push(s.kod);
    by.set(s.rdn_id, list);
  }
  return (rows ?? []).map((r) => ({
    ...r,
    kolicina: Number(r.kolicina),
    sati: r.sati == null ? null : Number(r.sati),
    serije: by.get(r.rdn_id) ?? [],
  }));
}

export async function createOpsRdn(input: {
  vrsta: RdnVrsta;
  datum: string;
  sablon_artikal_id?: number | null;
  jedinica_id?: number | null;
  kolicina?: number;
  sati?: number | null;
  radnik_id?: number | null;
  radnik_naziv?: string | null;
  napomena?: string | null;
}): Promise<{ broj: string; serije: string[]; rdn_id: number }> {
  await ensureOpsTables();
  const vrsta = input.vrsta;
  if (vrsta !== "SKLAPANJE" && vrsta !== "SERVIS") throw new Error("RDN_VRSTA");
  const datum = String(input.datum ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error("DATUM_REQUIRED");
  const closer = String(input.radnik_naziv ?? "").trim();
  if (!closer) throw new Error("KO_ZATVORIO");

  if (vrsta === "SERVIS") {
    return createRdnServis({ ...input, datum, closer });
  }
  return createRdnSklapanje({ ...input, datum, closer });
}

async function createRdnServis(input: {
  datum: string;
  closer: string;
  jedinica_id?: number | null;
  sati?: number | null;
  radnik_id?: number | null;
  napomena?: string | null;
}): Promise<{ broj: string; serije: string[]; rdn_id: number }> {
  const jedId = Number(input.jedinica_id);
  if (!jedId) throw new Error("JEDINICA_REQUIRED");
  const unit = await query<{ jedinica_id: number; kod: string; stanje: string }>(
    `SELECT jedinica_id, kod, stanje FROM ops_jedinice_opreme WHERE jedinica_id = ? LIMIT 1`,
    [jedId],
  );
  const u = unit?.[0];
  if (!u) throw new Error("JEDINICA_INVALID");
  if (u.stanje !== "SERVIS") throw new Error("JEDINICA_NIJE_NA_SERVISU");

  let broj = "";
  let rdnId = 0;
  await withTransaction(async (conn) => {
    broj = await nextBroj(conn, "ops_rdn", "RDN");
    const [ins] = (await conn.query(
      `INSERT INTO ops_rdn
         (broj, vrsta, datum, jedinica_id, kolicina, sati, radnik_id, radnik_naziv, status, napomena)
       VALUES (?, 'SERVIS', ?, ?, 1, ?, ?, ?, 'OTVOREN', ?)`,
      [
        broj,
        input.datum,
        jedId,
        input.sati != null && Number(input.sati) > 0 ? Number(input.sati) : null,
        input.radnik_id || null,
        input.closer,
        String(input.napomena ?? "").trim() || null,
      ],
    )) as unknown as [{ insertId?: number }];
    rdnId = Number(ins?.insertId ?? 0);
    if (!rdnId) throw new Error("RDN_INSERT");
    await conn.query(
      `UPDATE ops_jedinice_opreme SET rdn_id = ? WHERE jedinica_id = ?`,
      [rdnId, jedId],
    );
    await conn.query(
      `INSERT INTO ops_jedinica_zivot (jedinica_id, kod, akcija, osoba, napomena)
       VALUES (?, ?, 'RDN_SERVIS', ?, ?)`,
      [jedId, u.kod, input.closer, broj],
    );
  });
  return { broj, serije: [u.kod], rdn_id: rdnId };
}

async function createRdnSklapanje(input: {
  datum: string;
  closer: string;
  sablon_artikal_id?: number | null;
  kolicina?: number;
  sati?: number | null;
  radnik_id?: number | null;
  napomena?: string | null;
}): Promise<{ broj: string; serije: string[]; rdn_id: number }> {
  const sablonId = Number(input.sablon_artikal_id);
  const qty = Number(input.kolicina);
  if (!sablonId) throw new Error("SABLON_REQUIRED");
  if (!Number.isInteger(qty) || qty < 1) throw new Error("KOLICINA_CIJELI");

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
  let rdnId = 0;

  await withTransaction(async (conn) => {
    broj = await nextBroj(conn, "ops_rdn", "RDN");
    const [ins] = (await conn.query(
      `INSERT INTO ops_rdn
         (broj, vrsta, datum, sablon_artikal_id, kolicina, sati, radnik_id, radnik_naziv, status, napomena)
       VALUES (?, 'SKLAPANJE', ?, ?, ?, ?, ?, ?, 'ZATVOREN', ?)`,
      [
        broj,
        input.datum,
        sablonId,
        qty,
        input.sati != null && Number(input.sati) > 0 ? Number(input.sati) : null,
        input.radnik_id || null,
        input.closer,
        String(input.napomena ?? "").trim() || null,
      ],
    )) as unknown as [{ insertId?: number }];
    rdnId = Number(ins?.insertId ?? 0);
    if (!rdnId) throw new Error("RDN_INSERT");

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
        )) as unknown as [{ jedinica_id: number }[]];
        if (!Array.isArray(units) || units.length < take) {
          throw new Error(
            `Nedostaje ${line.sifra}: treba ${take} kom, slobodno ${units?.length ?? 0}`,
          );
        }
        for (const u of units) {
          await conn.query(
            `UPDATE ops_jedinice_opreme SET stanje = 'UGRADJENO', rdn_id = ? WHERE jedinica_id = ?`,
            [rdnId, u.jedinica_id],
          );
        }
      } else {
        const [stockRows] = (await conn.query(
          `SELECT kolicina FROM ops_stanje
           WHERE magacin_id = ? AND artikal_id = ? FOR UPDATE`,
          [line.default_magacin_id, line.komponenta_artikal_id],
        )) as unknown as [{ kolicina: number }[]];
        const have = Number(stockRows?.[0]?.kolicina ?? 0);
        if (have + 1e-9 < need) {
          throw new Error(
            `Nedostaje ${line.sifra}: treba ${need} ${line.jm_oznaka}, na stanju ${have}`,
          );
        }
        const [upd] = (await conn.query(
          `UPDATE ops_stanje SET kolicina = kolicina - ?
           WHERE magacin_id = ? AND artikal_id = ? AND kolicina >= ?`,
          [need, line.default_magacin_id, line.komponenta_artikal_id, need],
        )) as unknown as [{ affectedRows?: number }];
        if (!Number(upd?.affectedRows)) {
          throw new Error(`Nedostaje ${line.sifra}: stanje se promijenilo`);
        }
      }
      await conn.query(
        `INSERT INTO ops_rdn_potrosnja (rdn_id, artikal_id, magacin_id, kolicina)
         VALUES (?, ?, ?, ?)`,
        [rdnId, line.komponenta_artikal_id, line.default_magacin_id, need],
      );
    }

    const [cntRows] = (await conn.query(
      `SELECT COUNT(*) AS c FROM ops_jedinice_opreme WHERE artikal_id = ?`,
      [sablonId],
    )) as unknown as [{ c: number }[]];
    let n = Number(cntRows?.[0]?.c ?? 0);
    for (let i = 0; i < qty; i++) {
      n += 1;
      const kod = formatOpremaKod(sablonArt.sifra, n);
      serije.push(kod);
      await conn.query(
        `INSERT INTO ops_jedinice_opreme
           (kod, artikal_id, magacin_id, rdn_id, stanje)
         VALUES (?, ?, ?, ?, 'U_MAGACINU')`,
        [kod, sablonId, sablonArt.default_magacin_id, rdnId],
      );
    }
  });

  return { broj, serije, rdn_id: rdnId };
}

export async function predloziOtpisIzRadionice(input: {
  jedinica_id: number;
  osoba: string;
  napomena?: string | null;
}): Promise<void> {
  await ensureOpsTables();
  const jedId = Number(input.jedinica_id);
  const osoba = String(input.osoba ?? "").trim();
  if (!jedId) throw new Error("JEDINICA_REQUIRED");
  if (!osoba) throw new Error("OSOBA_REQUIRED");
  await withTransaction(async (conn) => {
    const [units] = (await conn.query(
      `SELECT jedinica_id, kod, stanje FROM ops_jedinice_opreme
       WHERE jedinica_id = ? FOR UPDATE`,
      [jedId],
    )) as unknown as [{ jedinica_id: number; kod: string; stanje: string }[]];
    const u = units?.[0];
    if (!u) throw new Error("JEDINICA_INVALID");
    if (u.stanje !== "SERVIS") throw new Error("OTPIS_SAMO_RADIONICA");
    await conn.query(
      `UPDATE ops_jedinice_opreme SET stanje = 'OTPIS', kompletacija_id = NULL
       WHERE jedinica_id = ?`,
      [jedId],
    );
    await conn.query(
      `INSERT INTO ops_jedinica_zivot
         (jedinica_id, kod, akcija, osoba, napomena)
       VALUES (?, ?, 'OTPIS', ?, ?)`,
      [jedId, u.kod, osoba, String(input.napomena ?? "").trim() || "Otpis iz radionice"],
    );
  });
}

export function normalizePrijemIzvor(raw: string | null | undefined): PrijemIzvor {
  const v = String(raw ?? "KUF").toUpperCase();
  if (v === "KES" || v === "PROIZVODNJA" || v === "KUF") return v;
  return "KUF";
}
