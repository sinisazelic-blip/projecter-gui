import { withTransaction } from "@/lib/db";
import type mysql from "mysql2/promise";
import {
  applyFxConversionNeutral,
  applyOwnerLoanFromPrivate,
  applyOwnerTransferToBlagajna,
  getOwnerEnv,
} from "@/lib/finance/ownerTransferApply";
import {
  deriveFakturaStatus,
  getFakturaTotal,
  getPartnerTolerancijaMax,
  sumPlacenoByFaktura,
} from "./invoiceStatus";
import {
  RASKNJIŽAVANJE_VRSTA,
  SPECIAL_PAYMENT_CFG,
  isoDate,
  round2,
  type AllocationLine,
  type CommitPayload,
} from "./types";

async function syncFakturaStatusConn(conn: mysql.PoolConnection, fakturaId: number) {
  const [totRows] = await conn.execute(
    `SELECT ROUND(COALESCE(iznos_ukupno_km, 0), 2) AS total FROM fakture WHERE faktura_id = ?`,
    [fakturaId],
  );
  const total = round2(Number((totRows as { total: number }[])?.[0]?.total ?? 0));
  const [paidRows] = await conn.execute(
    `SELECT ROUND(COALESCE(SUM(iznos_km), 0), 2) AS s FROM projektni_prihodi WHERE faktura_id = ?`,
    [fakturaId],
  );
  const paid = round2(Number((paidRows as { s: number }[])?.[0]?.s ?? 0));
  const status = deriveFakturaStatus(total, paid);
  const dbStatus = status === "PREPLACENA" ? "PLACENA" : status;
  await conn.execute(`UPDATE fakture SET fiskalni_status = ? WHERE faktura_id = ?`, [
    dbStatus,
    fakturaId,
  ]);
}

async function invoiceProjects(conn: mysql.PoolConnection, fakturaId: number) {
  const [rows] = await conn.execute(
    `SELECT projekat_id FROM faktura_projekti WHERE faktura_id = ? ORDER BY projekat_id ASC`,
    [fakturaId],
  );
  return (rows as { projekat_id: number }[])
    .map((r) => Number(r.projekat_id))
    .filter((x) => Number.isFinite(x) && x > 0);
}

async function createPrihodSplit(
  conn: mysql.PoolConnection,
  opts: {
    fakturaId: number;
    amountKm: number;
    datum: string;
    opis: string;
    klijentId?: number | null;
  },
): Promise<{ prihodId: number; amountKm: number }[]> {
  const projects = await invoiceProjects(conn, opts.fakturaId);
  if (!projects.length) throw new Error("Faktura nema vezane projekte");

  const amountKm = round2(opts.amountKm);
  const per = Math.floor((amountKm / projects.length) * 100) / 100;
  let remainder = round2(amountKm - per * projects.length);
  const parts: { prihodId: number; amountKm: number }[] = [];

  for (let i = 0; i < projects.length; i++) {
    const extra = remainder > 0 ? 0.01 : 0;
    if (remainder > 0) remainder = round2(remainder - 0.01);
    const part = round2(per + extra);
    if (part <= 0) continue;

    const [ins] = await conn.execute(
      `INSERT INTO projektni_prihodi (projekat_id, faktura_id, datum_prihoda, iznos_km, opis)
       VALUES (?, ?, ?, ?, ?)`,
      [projects[i], opts.fakturaId, opts.datum, part, opts.opis.slice(0, 255)],
    );
    const prihodId = (ins as { insertId?: number })?.insertId;
    if (prihodId) parts.push({ prihodId, amountKm: part });
  }
  return parts;
}

async function insertRasknjizavanje(
  conn: mysql.PoolConnection,
  row: {
    posting_id: number | null;
    iznos_km: number;
    vrsta: string;
    faktura_id?: number | null;
    trosak_id?: number | null;
    klijent_id?: number | null;
    talent_id?: number | null;
    dobavljac_id?: number | null;
    projekat_id?: number | null;
    prihod_id?: number | null;
    placanje_id?: number | null;
    napomena?: string | null;
  },
) {
  const [ins] = await conn.execute(
    `INSERT INTO fin_rasknjizavanje
      (posting_id, iznos_km, vrsta, faktura_id, trosak_id, klijent_id, talent_id, dobavljac_id, projekat_id, prihod_id, placanje_id, napomena, aktivan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.posting_id,
      row.iznos_km,
      row.vrsta,
      row.faktura_id ?? null,
      row.trosak_id ?? null,
      row.klijent_id ?? null,
      row.talent_id ?? null,
      row.dobavljac_id ?? null,
      row.projekat_id ?? null,
      row.prihod_id ?? null,
      row.placanje_id ?? null,
      row.napomena ?? null,
    ],
  );
  return (ins as { insertId?: number })?.insertId ?? null;
}

async function linkPostingPrihod(
  conn: mysql.PoolConnection,
  postingId: number,
  prihodId: number,
  amountKm: number,
) {
  await conn.execute(
    `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan)
     VALUES (?, ?, ?, 1)`,
    [postingId, prihodId, amountKm],
  );
}

async function allocateToTrosak(
  conn: mysql.PoolConnection,
  opts: {
    postingId: number;
    trosakId: number;
    amountKm: number;
    datum: string;
    napomena: string;
    partnerTip: "dobavljac" | "talent";
    partnerId: number;
  },
) {
  const [insPay] = await conn.execute(
    `INSERT INTO placanja
      (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
     VALUES (?, ?, 'BAM', 1.000000, ?, 'BANK', ?, ?)`,
    [
      opts.datum,
      opts.amountKm,
      opts.amountKm,
      `rasknjizavanje:posting_id=${opts.postingId}`,
      opts.napomena.slice(0, 255),
    ],
  );
  const placanjeId = (insPay as { insertId?: number })?.insertId;
  if (!placanjeId) throw new Error("Kreiranje plaćanja nije uspjelo");

  await conn.execute(
    `INSERT INTO placanja_stavke (placanje_id, trosak_id, iznos_km) VALUES (?, ?, ?)`,
    [placanjeId, opts.trosakId, opts.amountKm],
  );

  await conn.execute(
    `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
     VALUES (?, ?, ?, 1)`,
    [opts.postingId, placanjeId, opts.amountKm],
  );

  await insertRasknjizavanje(conn, {
    posting_id: opts.postingId,
    iznos_km: opts.amountKm,
    vrsta: RASKNJIŽAVANJE_VRSTA.ISPLATA_TROSKA,
    trosak_id: opts.trosakId,
    placanje_id: placanjeId,
    talent_id: opts.partnerTip === "talent" ? opts.partnerId : null,
    dobavljac_id: opts.partnerTip === "dobavljac" ? opts.partnerId : null,
    napomena: opts.napomena,
  });
}

async function allocateSpecialPayment(
  conn: mysql.PoolConnection,
  opts: {
    postingId: number;
    amountKm: number;
    datum: string;
    vrsta: string;
    napomena?: string | null;
    postingAmount: number;
    dobavljac_id?: number | null;
    talent_id?: number | null;
    klijent_id?: number | null;
    faktura_id?: number | null;
    projekat_id?: number | null;
  },
) {
  const cfg = SPECIAL_PAYMENT_CFG[opts.vrsta];
  if (!cfg) throw new Error(`Nepoznata specijalna vrsta: ${opts.vrsta}`);

  const napomena =
    (opts.napomena && String(opts.napomena).trim()) ||
    `${cfg.label} [posting ${opts.postingId}]`;
  const { ownerProjectId } = getOwnerEnv();
  const projekatId = opts.projekat_id ?? ownerProjectId;

  // Priliv (IN): DB trigger zabranjuje bank_tx_posting_placanje_link — koristi prihod_link.
  if (opts.postingAmount > 0) {
    const isRealIncome = opts.vrsta === RASKNJIŽAVANJE_VRSTA.KAMATA;
    const prihodIznos = isRealIncome ? opts.amountKm : 0;
    const [insPrihod] = await conn.execute(
      `INSERT INTO projektni_prihodi (projekat_id, datum_prihoda, iznos_km, opis)
       VALUES (?, ?, ?, ?)`,
      [projekatId, opts.datum, prihodIznos, napomena.slice(0, 255)],
    );
    const prihodId = (insPrihod as { insertId?: number })?.insertId;
    if (!prihodId) throw new Error(`${cfg.label}: prihod nije kreiran`);

    await conn.execute(
      `INSERT INTO bank_tx_posting_prihod_link (posting_id, prihod_id, amount_km, aktivan)
       VALUES (?, ?, ?, 1)`,
      [opts.postingId, prihodId, opts.amountKm],
    );
    await conn.execute(`UPDATE bank_tx_posting SET kategorija = ? WHERE posting_id = ?`, [
      cfg.kategorija,
      opts.postingId,
    ]);
    await insertRasknjizavanje(conn, {
      posting_id: opts.postingId,
      iznos_km: opts.amountKm,
      vrsta: opts.vrsta,
      prihod_id: prihodId,
      klijent_id: opts.klijent_id ?? null,
      faktura_id: opts.faktura_id ?? null,
      projekat_id: projekatId,
      napomena,
    });
    return prihodId;
  }

  // Odliv (OUT): placanje + placanje_link
  const [insPay] = await conn.execute(
    `INSERT INTO placanja
      (datum_placanja, iznos_original, valuta_original, kurs_u_km, iznos_km, nacin_placanja, referenca, napomena)
     VALUES (?, ?, 'BAM', 1.000000, ?, ?, ?, ?)`,
    [
      opts.datum,
      opts.amountKm,
      opts.amountKm,
      cfg.nacin,
      `${cfg.kategorija}:posting_id=${opts.postingId}`,
      napomena.slice(0, 255),
    ],
  );
  const placanjeId = (insPay as { insertId?: number })?.insertId;
  if (!placanjeId) throw new Error(`${cfg.label}: plaćanje nije kreirano`);

  await conn.execute(
    `INSERT INTO bank_tx_posting_placanje_link (posting_id, placanje_id, amount_km, aktivan)
     VALUES (?, ?, ?, 1)`,
    [opts.postingId, placanjeId, opts.amountKm],
  );
  await conn.execute(`UPDATE bank_tx_posting SET kategorija = ? WHERE posting_id = ?`, [
    cfg.kategorija,
    opts.postingId,
  ]);

  await insertRasknjizavanje(conn, {
    posting_id: opts.postingId,
    iznos_km: opts.amountKm,
    vrsta: opts.vrsta,
    placanje_id: placanjeId,
    dobavljac_id: opts.dobavljac_id ?? null,
    talent_id: opts.talent_id ?? null,
    klijent_id: opts.klijent_id ?? null,
    faktura_id: opts.faktura_id ?? null,
    projekat_id: projekatId,
    napomena,
  });

  return placanjeId;
}

async function processLine(
  conn: mysql.PoolConnection,
  postingId: number,
  posting: { amount: number; value_date: unknown; description: unknown },
  line: AllocationLine,
  datum: string,
) {
  const amountKm = round2(line.iznos_km);
  if (!(amountKm > 0)) return;

  if (line.vrsta === RASKNJIŽAVANJE_VRSTA.NAPLATA_FAKTURE) {
    const fakturaId = Number(line.faktura_id);
    if (!Number.isFinite(fakturaId) || fakturaId <= 0)
      throw new Error("NAPLATA_FAKTURE zahtijeva faktura_id");

    const opis =
      line.napomena ||
      String(posting.description || "").trim() ||
      `Uplata po izvodu`;
    const prihodParts = await createPrihodSplit(conn, {
      fakturaId,
      amountKm,
      datum,
      opis,
      klijentId: line.klijent_id,
    });

    for (const { prihodId, amountKm: partKm } of prihodParts) {
      await linkPostingPrihod(conn, postingId, prihodId, partKm);
      await insertRasknjizavanje(conn, {
        posting_id: postingId,
        iznos_km: partKm,
        vrsta: RASKNJIŽAVANJE_VRSTA.NAPLATA_FAKTURE,
        faktura_id: fakturaId,
        klijent_id: line.klijent_id ?? null,
        prihod_id: prihodId,
        napomena: line.napomena ?? null,
      });
    }
    await syncFakturaStatusConn(conn, fakturaId);
    return;
  }

  if (SPECIAL_PAYMENT_CFG[line.vrsta]) {
    const postingAmount = Number(posting.amount);
    const smjerIn = postingAmount > 0;
    const cfg = SPECIAL_PAYMENT_CFG[line.vrsta];
    if (smjerIn && !cfg.allowIn) {
      throw new Error(`${cfg.label} nije dozvoljeno za priliv`);
    }
    if (!smjerIn && !cfg.allowOut) {
      throw new Error(`${cfg.label} nije dozvoljeno za odliv`);
    }

    // Već knjiženo + faktura: zatvori posting; ako faktura još ima gap — dopuni prihod (bez bank_prihod_link).
    if (
      line.vrsta === RASKNJIŽAVANJE_VRSTA.VEC_KNJIZENO &&
      line.faktura_id &&
      Number(line.faktura_id) > 0
    ) {
      const fakturaId = Number(line.faktura_id);
      const total = await getFakturaTotal(fakturaId);
      const paidBefore = await sumPlacenoByFaktura(fakturaId);
      const gap = round2(Math.max(0, total - paidBefore));
      if (gap > 0.01) {
        const fill = round2(Math.min(gap, amountKm));
        const opis =
          line.napomena ||
          "Naplata usklađena (već knjiženo / blagajna)";
        const prihodParts = await createPrihodSplit(conn, {
          fakturaId,
          amountKm: fill,
          datum,
          opis,
          klijentId: line.klijent_id,
        });
        for (const { prihodId, amountKm: partKm } of prihodParts) {
          await insertRasknjizavanje(conn, {
            posting_id: postingId,
            iznos_km: partKm,
            vrsta: RASKNJIŽAVANJE_VRSTA.VEC_KNJIZENO,
            faktura_id: fakturaId,
            klijent_id: line.klijent_id ?? null,
            prihod_id: prihodId,
            napomena: opis,
          });
        }
        await syncFakturaStatusConn(conn, fakturaId);
      }
    }

    if (
      line.vrsta === RASKNJIŽAVANJE_VRSTA.DIREKTAN_TROSAK &&
      !line.dobavljac_id &&
      !line.talent_id
    ) {
      throw new Error("Direktan trošak zahtijeva odabranog dobavljača ili saradnika");
    }

    await allocateSpecialPayment(conn, {
      postingId,
      amountKm,
      datum,
      vrsta: line.vrsta,
      napomena: line.napomena,
      postingAmount,
      dobavljac_id: line.dobavljac_id,
      talent_id: line.talent_id,
      klijent_id: line.klijent_id,
      faktura_id: line.faktura_id,
      projekat_id: line.projekat_id,
    });
    return;
  }

  if (line.vrsta === RASKNJIŽAVANJE_VRSTA.PRENOS_VLASNIKA) {
    const { ownerPrivateAccountDigits, ownerProjectId } = getOwnerEnv();
    const postingRow = posting as Record<string, unknown>;
    const res = await applyOwnerTransferToBlagajna(
      conn,
      {
        posting_id: postingId,
        amount: Number(postingRow.amount),
        value_date: postingRow.value_date,
        currency: postingRow.currency != null ? String(postingRow.currency) : null,
        counterparty: postingRow.counterparty != null ? String(postingRow.counterparty) : null,
        description: postingRow.description != null ? String(postingRow.description) : null,
        staging_reference:
          postingRow.staging_reference != null ? String(postingRow.staging_reference) : null,
        staging_description:
          postingRow.staging_description != null ? String(postingRow.staging_description) : null,
        staging_full_description:
          postingRow.staging_full_description != null
            ? String(postingRow.staging_full_description)
            : null,
      },
      line.projekat_id ?? ownerProjectId,
      ownerPrivateAccountDigits,
      true,
    );
    if (!res.applied) {
      throw new Error(`Prenos u blagajnu nije moguć (${res.reason})`);
    }
    return;
  }

  if (line.vrsta === RASKNJIŽAVANJE_VRSTA.POSUDBA_VLASNIKA) {
    const { ownerPrivateAccountDigits, ownerProjectId } = getOwnerEnv();
    const postingRow = posting as Record<string, unknown>;
    const res = await applyOwnerLoanFromPrivate(
      conn,
      {
        posting_id: postingId,
        amount: Number(postingRow.amount),
        value_date: postingRow.value_date,
        counterparty: postingRow.counterparty != null ? String(postingRow.counterparty) : null,
        description: postingRow.description != null ? String(postingRow.description) : null,
        staging_reference:
          postingRow.staging_reference != null ? String(postingRow.staging_reference) : null,
        staging_description:
          postingRow.staging_description != null ? String(postingRow.staging_description) : null,
        staging_full_description:
          postingRow.staging_full_description != null
            ? String(postingRow.staging_full_description)
            : null,
      },
      line.projekat_id ?? ownerProjectId,
      ownerPrivateAccountDigits,
      true,
    );
    if (!res.applied) {
      throw new Error(`Posudba vlasnika nije moguća (${res.reason})`);
    }
    return;
  }

  if (line.vrsta === RASKNJIŽAVANJE_VRSTA.KONVERZIJA) {
    const { ownerProjectId } = getOwnerEnv();
    const postingRow = posting as Record<string, unknown>;
    const res = await applyFxConversionNeutral(
      conn,
      {
        posting_id: postingId,
        amount: Number(postingRow.amount),
        value_date: postingRow.value_date,
        description: postingRow.description != null ? String(postingRow.description) : null,
        counterparty: postingRow.counterparty != null ? String(postingRow.counterparty) : null,
        staging_description:
          postingRow.staging_description != null ? String(postingRow.staging_description) : null,
        staging_full_description:
          postingRow.staging_full_description != null
            ? String(postingRow.staging_full_description)
            : null,
      },
      line.projekat_id ?? ownerProjectId,
      true,
    );
    if (!res.applied) {
      throw new Error(`Konverzija nije moguća (${res.reason})`);
    }
    return;
  }

  if (line.vrsta === RASKNJIŽAVANJE_VRSTA.ISPLATA_TROSKA) {
    const trosakId = Number(line.trosak_id);
    if (!Number.isFinite(trosakId) || trosakId <= 0)
      throw new Error("ISPLATA_TROSKA zahtijeva trosak_id");

    const partnerTip = line.talent_id ? "talent" : "dobavljac";
    const partnerId = Number(line.talent_id || line.dobavljac_id);
    if (!Number.isFinite(partnerId) || partnerId <= 0)
      throw new Error("ISPLATA_TROSKA zahtijeva partnera");

    await allocateToTrosak(conn, {
      postingId,
      trosakId,
      amountKm,
      datum,
      napomena: line.napomena || String(posting.description || ""),
      partnerTip,
      partnerId,
    });
    return;
  }

  throw new Error(`Nepodržana vrsta alokacije: ${line.vrsta}`);
}

export async function commitRasknjizavanje(payload: CommitPayload) {
  const postingId = Number(payload.posting_id);
  if (!Number.isFinite(postingId) || postingId <= 0)
    return { ok: false as const, error: "posting_id invalid" };

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const lineSum = round2(lines.reduce((s, l) => s + Number(l.iznos_km || 0), 0));
  const tolKmPayload =
    payload.tolerancija?.faktura_id && payload.tolerancija.iznos_km > 0
      ? round2(payload.tolerancija.iznos_km)
      : 0;

  return withTransaction(async (conn) => {
    const [pRows] = await conn.execute(
      `SELECT
         p.posting_id, p.amount, p.value_date, p.description, p.counterparty, p.currency,
         t.reference AS staging_reference,
         t.description AS staging_description,
         t.full_description AS staging_full_description
       FROM bank_tx_posting p
       LEFT JOIN bank_tx_staging t ON t.tx_id = p.tx_id
       WHERE p.posting_id = ?`,
      [postingId],
    );
    const posting = (pRows as Record<string, unknown>[])?.[0];
    if (!posting) return { ok: false as const, error: "Posting nije pronađen" };

    const amount = Number(posting.amount);
    const cap = round2(Math.abs(amount));
    const datum =
      isoDate(posting.value_date) || new Date().toISOString().slice(0, 10);

    const [sanRows] = await conn.execute(
      `SELECT linked_total_km FROM v_bank_posting_sanity WHERE posting_id = ?`,
      [postingId],
    );
    const used = round2(Number((sanRows as { linked_total_km: number }[])?.[0]?.linked_total_km ?? 0));

    if (lineSum > 0.01 && used + lineSum > cap + 0.01) {
      return {
        ok: false as const,
        error: "Alokacija premašuje iznos postinga",
        cap,
        used,
        try_add: lineSum,
      };
    }

    if (lineSum < 0.005 && tolKmPayload < 0.005) {
      return {
        ok: false as const,
        error: "Nema alokacije ni otpisa tolerancije",
      };
    }

    const touchedFakture = new Set<number>();

    for (const line of lines) {
      await processLine(conn, postingId, posting as { amount: number; value_date: unknown; description: unknown }, line, datum);
      if (line.faktura_id) touchedFakture.add(Number(line.faktura_id));
    }

    if (payload.tolerancija?.faktura_id && payload.tolerancija.iznos_km > 0) {
      const fakturaId = Number(payload.tolerancija.faktura_id);
      const tolKm = round2(payload.tolerancija.iznos_km);

      const [invRows] = await conn.execute(
        `SELECT bill_to_klijent_id FROM fakture WHERE faktura_id = ? LIMIT 1`,
        [fakturaId],
      );
      const klijentId = Number((invRows as { bill_to_klijent_id: number }[])?.[0]?.bill_to_klijent_id);
      if (klijentId > 0) {
        const maxTol = await getPartnerTolerancijaMax("klijent", klijentId);
        if (maxTol > 0 && tolKm > maxTol + 0.01) {
          return {
            ok: false as const,
            error: `Otpis ${tolKm} premašuje toleranciju (${maxTol})`,
          };
        }
      }

      const total = await getFakturaTotal(fakturaId);
      const paidBefore = await sumPlacenoByFaktura(fakturaId);
      const gap = round2(total - paidBefore);
      if (tolKm > gap + 0.01) {
        return { ok: false as const, error: "Otpis premašuje preostali dug na fakturi" };
      }

      const opis =
        payload.tolerancija.napomena ||
        `Otpis tolerancije (bankarska razlika)`;
      const prihodParts = await createPrihodSplit(conn, {
        fakturaId,
        amountKm: tolKm,
        datum,
        opis,
        klijentId,
      });

      for (const { prihodId, amountKm: partKm } of prihodParts) {
        await insertRasknjizavanje(conn, {
          posting_id: null,
          iznos_km: partKm,
          vrsta: RASKNJIŽAVANJE_VRSTA.OTPIS_TOLERANCIJE,
          faktura_id: fakturaId,
          klijent_id: klijentId > 0 ? klijentId : null,
          prihod_id: prihodId,
          napomena: opis,
        });
      }
      touchedFakture.add(fakturaId);
    }

    for (const fid of touchedFakture) {
      await syncFakturaStatusConn(conn, fid);
    }

    const [san2] = await conn.execute(
      `SELECT linked_total_km, alloc_status FROM v_bank_posting_sanity WHERE posting_id = ?`,
      [postingId],
    );

    return {
      ok: true as const,
      posting_id: postingId,
      allocated_km: lineSum,
      tolerancija_km: round2(payload.tolerancija?.iznos_km ?? 0),
      sanity: (san2 as Record<string, unknown>[])?.[0] ?? null,
      faktura_ids: [...touchedFakture],
    };
  });
}
