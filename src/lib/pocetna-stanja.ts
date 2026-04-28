import { query } from "@/lib/db";

type Row = Record<string, unknown>;

export type PocetnaStanjaRow = {
  napomena: string | null;
  iznos_km: number;
  paid_km?: number;
  remaining_km?: number;
  otpisano?: boolean;
  otpis_razlog?: string | null;
  otpis_datum?: string | null;
};

export type PocetnaStanja = {
  klijenti: ({ klijent_id: number; naziv: string } & PocetnaStanjaRow)[];
  dobavljaci: ({ dobavljac_id: number; naziv: string } & PocetnaStanjaRow)[];
  talenti: ({ talent_id: number; naziv: string } & PocetnaStanjaRow)[];
};

/** Učitaj tekuća dugovanja po dobavljaču (preostalo iz projekt_dugovanja). */
async function getDugovanjaByDobavljac(): Promise<{ dobavljac_id: number; naziv: string; iznos_km: number }[]> {
  try {
    const rows = (await query(
      `
      SELECT d.dobavljac_id, dob.naziv,
             (SUM(COALESCE(d.iznos_km, 0)) - SUM(COALESCE(v.paid_km, v.paid_sum_km, v.paid_sum, 0))) AS iznos_km
      FROM projekt_dugovanja d
      JOIN dobavljaci dob ON dob.dobavljac_id = d.dobavljac_id
      LEFT JOIN v_dugovanja_paid_sum v ON v.dugovanje_id = d.dugovanje_id
      WHERE d.dobavljac_id IS NOT NULL
      GROUP BY d.dobavljac_id, dob.naziv
      HAVING iznos_km > 0.001
      ORDER BY dob.naziv ASC
      `,
    )) as Row[];
    return (rows || []).map((r) => ({
      dobavljac_id: Number(r.dobavljac_id),
      naziv: String(r.naziv ?? ""),
      iznos_km: Number(Number(r.iznos_km).toFixed(2)),
    }));
  } catch {
    return [];
  }
}

/** Učitaj tekuća dugovanja po talentu (preostalo iz projekt_dugovanja), ako tabela ima talent_id. */
async function getDugovanjaByTalent(): Promise<{ talent_id: number; naziv: string; iznos_km: number }[]> {
  try {
    const rows = (await query(
      `
      SELECT d.talent_id, t.ime_prezime AS naziv,
             (SUM(COALESCE(d.iznos_km, 0)) - SUM(COALESCE(v.paid_km, v.paid_sum_km, v.paid_sum, 0))) AS iznos_km
      FROM projekt_dugovanja d
      JOIN talenti t ON t.talent_id = d.talent_id
      LEFT JOIN v_dugovanja_paid_sum v ON v.dugovanje_id = d.dugovanje_id
      WHERE d.talent_id IS NOT NULL
      GROUP BY d.talent_id, t.ime_prezime
      HAVING iznos_km > 0.001
      ORDER BY t.ime_prezime ASC
      `,
    )) as Row[];
    return (rows || []).map((r) => ({
      talent_id: Number(r.talent_id),
      naziv: String(r.naziv ?? ""),
      iznos_km: Number(Number(r.iznos_km).toFixed(2)),
    }));
  } catch {
    return [];
  }
}

export async function getPocetnaStanja(): Promise<PocetnaStanja> {
  const out: PocetnaStanja = { klijenti: [], dobavljaci: [], talenti: [] };

  // --- Uplate/izmirenja početnih stanja (računa "plaćeno" i "preostalo") ---
  // Ako tabela ne postoji (još nije migrirano), tretiraj kao 0.
  const paidByKey = new Map<string, number>();
  try {
    const sums = (await query(
      `
      SELECT tip, ref_id, ROUND(SUM(COALESCE(amount_km, 0)), 2) AS paid_km
      FROM pocetno_stanje_uplate
      WHERE aktivan = 1
      GROUP BY tip, ref_id
      `,
      [],
    )) as Row[];
    for (const r of sums || []) {
      const tip = String(r.tip || "");
      const ref = Number(r.ref_id);
      const paid = Number(r.paid_km || 0);
      if (!tip || !Number.isFinite(ref)) continue;
      paidByKey.set(`${tip}:${ref}`, paid);
    }
  } catch {
    // ignore (tabela možda ne postoji)
  }

  const attachPaid = <T extends { iznos_km: number; napomena?: string | null }>(
    tip: "klijent" | "dobavljac" | "talent",
    refId: number,
    row: T,
    opts?: { skip?: boolean },
  ) => {
    if (opts?.skip) {
      return { ...row, paid_km: 0, remaining_km: Number(row.iznos_km || 0) };
    }
    const paid = paidByKey.get(`${tip}:${refId}`) ?? 0;
    const iznos = Number(row.iznos_km || 0);
    const remaining = Math.max(0, Number((iznos - paid).toFixed(2)));
    return { ...row, paid_km: paid, remaining_km: remaining };
  };

  // --- Klijenti (samo iz klijent_pocetno_stanje) ---
  try {
    const rows = (await query(
      `
      SELECT p.klijent_id, k.naziv_klijenta AS naziv,
             COALESCE(p.iznos_potrazuje, 0) AS iznos_km, p.napomena,
             COALESCE(p.otpisano, 0) AS otpisano, p.otpis_razlog, p.otpis_datum
      FROM klijent_pocetno_stanje p
      JOIN klijenti k ON k.klijent_id = p.klijent_id
      ORDER BY k.naziv_klijenta ASC
      `,
    )) as Row[];
    out.klijenti = (rows || []).map((r) => ({
      ...attachPaid(
        "klijent",
        Number(r.klijent_id),
        {
          klijent_id: Number(r.klijent_id),
          naziv: String(r.naziv ?? ""),
          iznos_km: Number(r.iznos_km ?? 0),
          napomena: r.napomena != null ? String(r.napomena) : null,
          otpisano: Number(r.otpisano) === 1,
          otpis_razlog: r.otpis_razlog != null ? String(r.otpis_razlog) : null,
          otpis_datum: r.otpis_datum != null ? String(r.otpis_datum) : null,
        },
      ),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("otpisano") || msg.includes("otpis_razlog")) {
      try {
        const rows = (await query(
          `SELECT p.klijent_id, k.naziv_klijenta AS naziv, COALESCE(p.iznos_potrazuje, 0) AS iznos_km, p.napomena
           FROM klijent_pocetno_stanje p JOIN klijenti k ON k.klijent_id = p.klijent_id ORDER BY k.naziv_klijenta ASC`,
          [],
        )) as Row[];
        out.klijenti = (rows || []).map((r) => ({
          ...attachPaid(
            "klijent",
            Number(r.klijent_id),
            {
              klijent_id: Number(r.klijent_id),
              naziv: String(r.naziv ?? ""),
              iznos_km: Number(r.iznos_km ?? 0),
              napomena: r.napomena != null ? String(r.napomena) : null,
            },
          ),
        }));
      } catch {
        console.error("[pocetna-stanja] klijent_pocetno_stanje:", msg);
      }
    } else {
      console.error("[pocetna-stanja] klijent_pocetno_stanje:", msg);
    }
  }

  // --- Dobavljači: početna stanja + dopuna iz tekućih dugovanja ---
  try {
    const rows = (await query(
      `
      SELECT p.dobavljac_id, d.naziv,
             COALESCE(p.iznos_duga, 0) AS iznos_km, p.napomena,
             COALESCE(p.otpisano, 0) AS otpisano, p.otpis_razlog, p.otpis_datum
      FROM dobavljac_pocetno_stanje p
      JOIN dobavljaci d ON d.dobavljac_id = p.dobavljac_id
      ORDER BY d.naziv ASC
      `,
    )) as Row[];
    out.dobavljaci = (rows || []).map((r) => ({
      ...attachPaid(
        "dobavljac",
        Number(r.dobavljac_id),
        {
          dobavljac_id: Number(r.dobavljac_id),
          naziv: String(r.naziv ?? ""),
          iznos_km: Number(r.iznos_km ?? 0),
          napomena: r.napomena != null ? String(r.napomena) : null,
          otpisano: Number(r.otpisano) === 1,
          otpis_razlog: r.otpis_razlog != null ? String(r.otpis_razlog) : null,
          otpis_datum: r.otpis_datum != null ? String(r.otpis_datum) : null,
        },
      ),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("otpisano") || msg.includes("otpis_razlog")) {
      try {
        const rows = (await query(
          `SELECT p.dobavljac_id, d.naziv, COALESCE(p.iznos_duga, 0) AS iznos_km, p.napomena
           FROM dobavljac_pocetno_stanje p JOIN dobavljaci d ON d.dobavljac_id = p.dobavljac_id ORDER BY d.naziv ASC`,
          [],
        )) as Row[];
        out.dobavljaci = (rows || []).map((r) => ({
          ...attachPaid(
            "dobavljac",
            Number(r.dobavljac_id),
            {
              dobavljac_id: Number(r.dobavljac_id),
              naziv: String(r.naziv ?? ""),
              iznos_km: Number(r.iznos_km ?? 0),
              napomena: r.napomena != null ? String(r.napomena) : null,
            },
          ),
        }));
      } catch {
        console.error("[pocetna-stanja] dobavljac_pocetno_stanje:", msg);
      }
    } else {
      console.error("[pocetna-stanja] dobavljac_pocetno_stanje:", msg);
    }
  }

  const tekucaDobavljaci = await getDugovanjaByDobavljac();
  const imamoDobavljacIds = new Set(out.dobavljaci.map((x) => x.dobavljac_id));
  for (const r of tekucaDobavljaci) {
    if (imamoDobavljacIds.has(r.dobavljac_id)) continue;
    out.dobavljaci.push({
      dobavljac_id: r.dobavljac_id,
      naziv: r.naziv,
      iznos_km: r.iznos_km,
      paid_km: 0,
      remaining_km: r.iznos_km,
      napomena: "Tekuće dugovanje (projekt_dugovanja)",
      otpisano: false,
    });
    imamoDobavljacIds.add(r.dobavljac_id);
  }
  out.dobavljaci.sort((a, b) => a.naziv.localeCompare(b.naziv, "hr"));

  // --- Talenti: početna stanja + dopuna iz tekućih dugovanja ---
  try {
    const rows = (await query(
      `
      SELECT p.talent_id, t.ime_prezime AS naziv,
             COALESCE(p.iznos_duga, 0) AS iznos_km, p.napomena,
             COALESCE(p.otpisano, 0) AS otpisano, p.otpis_razlog, p.otpis_datum
      FROM talent_pocetno_stanje p
      JOIN talenti t ON t.talent_id = p.talent_id
      ORDER BY t.ime_prezime ASC
      `,
    )) as Row[];
    out.talenti = (rows || []).map((r) => ({
      ...attachPaid(
        "talent",
        Number(r.talent_id),
        {
          talent_id: Number(r.talent_id),
          naziv: String(r.naziv ?? ""),
          iznos_km: Number(r.iznos_km ?? 0),
          napomena: r.napomena != null ? String(r.napomena) : null,
          otpisano: Number(r.otpisano) === 1,
          otpis_razlog: r.otpis_razlog != null ? String(r.otpis_razlog) : null,
          otpis_datum: r.otpis_datum != null ? String(r.otpis_datum) : null,
        },
      ),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("otpisano") || msg.includes("otpis_razlog")) {
      try {
        const rows = (await query(
          `SELECT p.talent_id, t.ime_prezime AS naziv, COALESCE(p.iznos_duga, 0) AS iznos_km, p.napomena
           FROM talent_pocetno_stanje p JOIN talenti t ON t.talent_id = p.talent_id ORDER BY t.ime_prezime ASC`,
          [],
        )) as Row[];
        out.talenti = (rows || []).map((r) => ({
          ...attachPaid(
            "talent",
            Number(r.talent_id),
            {
              talent_id: Number(r.talent_id),
              naziv: String(r.naziv ?? ""),
              iznos_km: Number(r.iznos_km ?? 0),
              napomena: r.napomena != null ? String(r.napomena) : null,
            },
          ),
        }));
      } catch {
        console.error("[pocetna-stanja] talent_pocetno_stanje:", msg);
      }
    } else {
      console.error("[pocetna-stanja] talent_pocetno_stanje:", msg);
    }
  }

  const tekucaTalenti = await getDugovanjaByTalent();
  const imamoTalentIds = new Set(out.talenti.map((x) => x.talent_id));
  for (const r of tekucaTalenti) {
    if (imamoTalentIds.has(r.talent_id)) continue;
    out.talenti.push({
      talent_id: r.talent_id,
      naziv: r.naziv,
      iznos_km: r.iznos_km,
      paid_km: 0,
      remaining_km: r.iznos_km,
      napomena: "Tekuće dugovanje (projekt_dugovanja)",
      otpisano: false,
    });
    imamoTalentIds.add(r.talent_id);
  }
  out.talenti.sort((a, b) => a.naziv.localeCompare(b.naziv, "hr"));

  return out;
}
