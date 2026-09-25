/**
 * Blagajna – čitanje i upis u bazu (tabela blagajna_stavke).
 * Za pretragu po datumu i entitetu (talent, dobavljač).
 */
import { query } from "@/lib/db";

export type CashDirection = "IN" | "OUT";
export type CashStatus = "AKTIVAN" | "STORNIRAN";

export type CashEntry = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: CashDirection;
  note: string;
  projectId: string | null;
  projectName?: string | null;
  projectIdPo?: string | null;
  entityType: string | null;
  entityId: number | null;
  entityName?: string | null;
  status: CashStatus;
  createdAt: string;
  transactionDetails?: string | null;
};

export type ListCashFilters = {
  dateFrom?: string | null; // YYYY-MM-DD
  dateTo?: string | null;
  entityType?: string | null; // 'talent' | 'vendor' | 'klijent'
  entityId?: number | null;
  status?: CashStatus | null; // AKTIVAN | STORNIRAN
  includeAllStatuses?: boolean; // true = prikaži i stornirane (istorija)
  limit?: number;
};

function rowToEntry(r: any): CashEntry {
  let dateVal = "";
  if (r.datum) {
    if (r.datum instanceof Date && !Number.isNaN(r.datum.getTime())) {
      dateVal = r.datum.toISOString().slice(0, 10);
    } else {
      const s = String(r.datum);
      const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      dateVal = match ? match[0] : s.slice(0, 10);
    }
  }
  const dateIso = dateVal ? `${dateVal}T12:00:00.000Z` : new Date().toISOString();
  const createdAt = r.created_at
    ? new Date(r.created_at).toISOString()
    : new Date().toISOString();

  let entityName: string | null = null;
  if (r.entity_type === "talent") {
    entityName = r.talent_naziv ?? null;
  } else if (r.entity_type === "vendor" || r.entity_type === "dobavljac") {
    entityName = r.vendor_naziv ?? null;
  } else if (r.entity_type === "klijent" || r.entity_type === "client") {
    entityName = r.klijent_naziv ?? null;
  }

  return {
    id: String(r.id),
    date: dateIso,
    amount: Number(r.iznos ?? 0),
    currency: String(r.valuta ?? "KM"),
    direction: r.smjer === "OUT" ? "OUT" : "IN",
    note: String(r.napomena ?? ""),
    projectId: r.project_id != null ? String(r.project_id) : null,
    projectName: r.project_naziv ?? null,
    projectIdPo: r.project_id_po ?? null,
    entityType: r.entity_type != null && r.entity_type !== "" ? String(r.entity_type) : null,
    entityId: r.entity_id != null && Number.isFinite(Number(r.entity_id)) ? Number(r.entity_id) : null,
    entityName: entityName,
    status: r.status === "STORNIRAN" ? "STORNIRAN" : "AKTIVAN",
    createdAt,
    transactionDetails: r.transaction_details ?? null,
  };
}

export function computeBalanceFromItems(items: CashEntry[]): number {
  return items.reduce((acc, it) => {
    if (it.status !== "AKTIVAN") return acc;
    const sign = it.direction === "IN" ? 1 : -1;
    return acc + sign * it.amount;
  }, 0);
}

/**
 * Lista stavki iz baze s opcionalnim filterima (datum, entitet).
 */
export async function listCashFromDb(filters: ListCashFilters = {}): Promise<CashEntry[]> {
  const {
    dateFrom,
    dateTo,
    entityType,
    entityId,
    status,
    includeAllStatuses = false,
    limit = 500,
  } = filters;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (dateFrom) {
    where.push("b.datum >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push("b.datum <= ?");
    params.push(dateTo);
  }
  if (entityType) {
    where.push("b.entity_type = ?");
    params.push(entityType);
  }
  if (entityId != null && Number.isFinite(entityId)) {
    where.push("b.entity_id = ?");
    params.push(entityId);
  }
  if (!includeAllStatuses) {
    where.push("b.status = ?");
    params.push(status ?? "AKTIVAN");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, limit), 2000);

  const rows = (await query(
    `SELECT b.id, b.datum, b.iznos, b.valuta, b.smjer, b.napomena, b.project_id, b.entity_type, b.entity_id,
            b.transaction_details, b.status, b.created_at,
            p.radni_naziv AS project_naziv, p.id_po AS project_id_po,
            t.ime_prezime AS talent_naziv,
            d.naziv AS vendor_naziv,
            k.naziv_klijenta AS klijent_naziv
     FROM blagajna_stavke b
     LEFT JOIN projekti p ON p.projekat_id = b.project_id
     LEFT JOIN talenti t ON (b.entity_type = 'talent' AND t.talent_id = b.entity_id)
     LEFT JOIN dobavljaci d ON (b.entity_type IN ('vendor', 'dobavljac') AND d.dobavljac_id = b.entity_id)
     LEFT JOIN klijenti k ON (b.entity_type IN ('klijent', 'client') AND k.klijent_id = b.entity_id)
     ${whereSql}
     ORDER BY b.datum DESC, b.created_at DESC, b.id DESC
     LIMIT ?`,
    [...params, safeLimit]
  )) as any[];

  return (rows ?? []).map(rowToEntry);
}

/**
 * Unos nove stavke u bazu. Vraća kreiranu stavku.
 */
export async function insertCashDraftDb(input: {
  date?: string | null;
  amount: number;
  currency?: string;
  direction: CashDirection;
  note: string;
  projectId?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  transactionDetails?: string | null;
}): Promise<CashEntry> {
  const dateVal = input.date ? String(input.date).slice(0, 10) : null;
  const datum = dateVal || new Date().toISOString().slice(0, 10);
  const valuta = (input.currency ?? "KM").toString();
  const napomena = input.note.trim();
  const projectId = input.projectId != null && input.projectId !== "" ? Number(input.projectId) : null;
  const entityType = input.entityType && input.entityType !== "" ? input.entityType : null;
  const entityId = input.entityId != null && Number.isFinite(input.entityId) ? input.entityId : null;
  const transactionDetails = input.transactionDetails?.trim() || null;

  const res = (await query(
    `INSERT INTO blagajna_stavke
     (datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id, transaction_details, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKTIVAN')`,
    [
      datum,
      input.amount,
      valuta,
      input.direction,
      napomena,
      projectId,
      entityType,
      entityId,
      transactionDetails,
    ]
  )) as any;

  const insertId = res?.insertId ?? res?.insertid ?? res?.rows?.[0]?.insertId;
  if (!insertId) {
    throw new Error("Blagajna: INSERT nije vratio id");
  }

  const rows = (await query(
    `SELECT id, datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id,
            transaction_details, status, created_at
     FROM blagajna_stavke WHERE id = ?`,
    [insertId]
  )) as any[];

  const row = rows?.[0];
  if (!row) throw new Error("Blagajna: nije pronađen kreirani red");
  return rowToEntry(row);
}

/**
 * Ažuriranje postojeće stavke blagajne iz istorije.
 */
export async function updateCashEntryDb(input: {
  id: number;
  date?: string | null;
  amount?: number;
  currency?: string | null;
  direction?: CashDirection | null;
  status?: CashStatus | null;
  note?: string | null;
  projectId?: string | number | null;
  entityType?: string | null;
  entityId?: number | null;
}): Promise<CashEntry> {
  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("INVALID_ID");

  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  if (input.date !== undefined) {
    const d = input.date ? String(input.date).slice(0, 10) : null;
    sets.push("datum = ?");
    params.push(d);
  }
  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
    sets.push("iznos = ?");
    params.push(amount);
  }
  if (input.currency !== undefined) {
    const valuta = input.currency == null ? null : String(input.currency).trim();
    sets.push("valuta = ?");
    params.push(valuta || null);
  }
  if (input.direction !== undefined) {
    const smjer = input.direction;
    if (smjer !== "IN" && smjer !== "OUT" && smjer !== null) throw new Error("INVALID_DIRECTION");
    sets.push("smjer = ?");
    params.push(smjer);
  }
  if (input.status !== undefined) {
    const status = input.status;
    if (status !== "AKTIVAN" && status !== "STORNIRAN" && status !== null) throw new Error("INVALID_STATUS");
    sets.push("status = ?");
    params.push(status);
  }
  if (input.note !== undefined) {
    const napomena = input.note == null ? null : String(input.note).trim();
    if (!napomena) throw new Error("NOTE_REQUIRED");
    sets.push("napomena = ?");
    params.push(napomena);
  }
  if (input.projectId !== undefined) {
    const pRaw = input.projectId;
    const p = pRaw == null || pRaw === "" ? null : Number(pRaw);
    if (p !== null && (!Number.isFinite(p) || p <= 0)) throw new Error("INVALID_PROJECT_ID");
    sets.push("project_id = ?");
    params.push(p);
  }
  if (input.entityType !== undefined) {
    const et = input.entityType == null ? null : String(input.entityType).trim().toLowerCase();
    sets.push("entity_type = ?");
    params.push(et || null);
  }
  if (input.entityId !== undefined) {
    const entityId = input.entityId == null ? null : Number(input.entityId);
    if (entityId !== null && (!Number.isFinite(entityId) || entityId <= 0)) throw new Error("INVALID_ENTITY_ID");
    sets.push("entity_id = ?");
    params.push(entityId);
  }

  if (!sets.length) throw new Error("NOTHING_TO_UPDATE");

  await query(
    `UPDATE blagajna_stavke
     SET ${sets.join(", ")}
     WHERE id = ?`,
    [...params, id],
  );

  const rows = (await query(
    `SELECT id, datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id,
            transaction_details, status, created_at
     FROM blagajna_stavke WHERE id = ?
     LIMIT 1`,
    [id]
  )) as any[];

  const row = rows?.[0];
  if (!row) throw new Error("CASH_ENTRY_NOT_FOUND");
  return rowToEntry(row);
}
