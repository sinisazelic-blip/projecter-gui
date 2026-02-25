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
  entityType: string | null;
  entityId: number | null;
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
  const dateVal = r.datum ? String(r.datum).slice(0, 10) : "";
  const dateIso = dateVal ? `${dateVal}T12:00:00.000Z` : new Date().toISOString();
  const createdAt = r.created_at
    ? new Date(r.created_at).toISOString()
    : new Date().toISOString();
  return {
    id: String(r.id),
    date: dateIso,
    amount: Number(r.iznos ?? 0),
    currency: String(r.valuta ?? "KM"),
    direction: r.smjer === "OUT" ? "OUT" : "IN",
    note: String(r.napomena ?? ""),
    projectId: r.project_id != null ? String(r.project_id) : null,
    entityType: r.entity_type != null && r.entity_type !== "" ? String(r.entity_type) : null,
    entityId: r.entity_id != null && Number.isFinite(Number(r.entity_id)) ? Number(r.entity_id) : null,
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
    where.push("datum >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push("datum <= ?");
    params.push(dateTo);
  }
  if (entityType) {
    where.push("entity_type = ?");
    params.push(entityType);
  }
  if (entityId != null && Number.isFinite(entityId)) {
    where.push("entity_id = ?");
    params.push(entityId);
  }
  if (!includeAllStatuses) {
    where.push("status = ?");
    params.push(status ?? "AKTIVAN");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, limit), 2000);

  const rows = (await query(
    `SELECT id, datum, iznos, valuta, smjer, napomena, project_id, entity_type, entity_id,
            transaction_details, status, created_at
     FROM blagajna_stavke
     ${whereSql}
     ORDER BY datum DESC, created_at DESC, id DESC
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
