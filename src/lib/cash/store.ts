import fs from "fs";
import path from "path";

export type CashDirection = "IN" | "OUT";
export type CashStatus = "DRAFT";

export type CashEntry = {
  id: string;
  date: string; // ISO string
  amount: number; // pozitivno
  currency: string; // "KM" default
  direction: CashDirection;
  note: string;
  projectId: string | null;
  status: CashStatus; // "DRAFT"
  createdAt: string; // ISO
  transactionDetails?: string; // Opis što se desilo (npr. "Projekat #123 arhiviran")
};

type CashFile = {
  version: 1;
  items: CashEntry[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const CASH_PATH = path.join(DATA_DIR, "cash.json");

function ensureStore(): CashFile {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CASH_PATH)) {
    const init: CashFile = { version: 1, items: [] };
    fs.writeFileSync(CASH_PATH, JSON.stringify(init, null, 2), "utf8");
    return init;
  }
  const raw = fs.readFileSync(CASH_PATH, "utf8");
  const parsed = raw
    ? (JSON.parse(raw) as CashFile)
    : ({ version: 1, items: [] } as CashFile);
  if (!parsed?.items) return { version: 1, items: [] };
  return parsed;
}

function writeStore(store: CashFile) {
  fs.writeFileSync(CASH_PATH, JSON.stringify(store, null, 2), "utf8");
}

function cuidLike() {
  // dovoljno dobro za signalni sloj; kasnije DB daje pravi ID
  return "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function listCash(limit = 500) {
  const store = ensureStore();
  const items = [...store.items].sort((a, b) => {
    // date desc, then createdAt desc
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return items.slice(0, limit);
}

export function computeBalance(items: CashEntry[]) {
  return items.reduce((acc, it) => {
    const sign = it.direction === "IN" ? 1 : -1;
    return acc + sign * it.amount;
  }, 0);
}

export function createCashDraft(input: {
  date?: string;
  amount: number;
  currency?: string;
  direction: CashDirection;
  note: string;
  projectId?: string | null;
  transactionDetails?: string;
}): CashEntry {
  const store = ensureStore();

  const nowIso = new Date().toISOString();
  const dateIso = input.date ? new Date(input.date).toISOString() : nowIso;

  const entry: CashEntry = {
    id: cuidLike(),
    date: dateIso,
    amount: input.amount,
    currency: (input.currency ?? "KM").toString(),
    direction: input.direction,
    note: input.note.trim(),
    projectId: input.projectId ?? null,
    status: "DRAFT",
    createdAt: nowIso,
    transactionDetails: input.transactionDetails,
  };

  store.items.push(entry);
  writeStore(store);
  return entry;
}
