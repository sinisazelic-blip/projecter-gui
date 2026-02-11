// src/lib/datetime.ts
export const pad2 = (n: number) => String(n).padStart(2, "0");

export const isDDMMYYYY = (s: string) =>
  /^\d{2}\.\d{2}\.\d{4}$/.test(String(s || "").trim());
export const isDDMMYYYY_HHMM = (s: string) =>
  /^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/.test(String(s || "").trim());

export function normalizeDDMMYYYY(input: string): string {
  const digits = String(input || "")
    .replace(/\D/g, "")
    .slice(0, 8); // ddmmyyyy
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  let out = dd;
  if (mm) out += "." + mm;
  if (yyyy) out += "." + yyyy;
  return out;
}

export function normalizeDDMMYYYY_HHMM(input: string): string {
  const digits = String(input || "")
    .replace(/\D/g, "")
    .slice(0, 12); // ddmmyyyyhhmm
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const hh = digits.slice(8, 10);
  const mi = digits.slice(10, 12);

  let out = dd;
  if (mm) out += "." + mm;
  if (yyyy) out += "." + yyyy;
  if (hh || mi) out += " ";
  if (hh) out += hh;
  if (mi) out += ":" + mi;
  return out;
}

export function ddmmyyyyToISODate(ddmmyyyy: string): string | null {
  const s = String(ddmmyyyy || "").trim();
  if (!isDDMMYYYY(s)) return null;

  const [dd, mm, yyyy] = s.split(".");
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y))
    return null;
  if (y < 1900 || y > 2200) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  const iso = `${y}-${pad2(m)}-${pad2(d)}`;
  const check = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(check.getTime())) return null;

  return iso;
}

export function isoDateToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// dd.mm.yyyy HH:mm → "YYYY-MM-DD HH:mm:ss"
export function humanDTToMySql(ddmmyyyyHHmm: string): string | null {
  const s = String(ddmmyyyyHHmm || "").trim();
  if (!isDDMMYYYY_HHMM(s)) return null;

  const [datePart, timePart] = s.split(/\s+/);
  const isoDate = ddmmyyyyToISODate(datePart);
  if (!isoDate) return null;

  const [hh, mi] = timePart.split(":");
  const H = Number(hh);
  const M = Number(mi);
  if (!Number.isFinite(H) || !Number.isFinite(M)) return null;
  if (H < 0 || H > 23) return null;
  if (M < 0 || M > 59) return null;

  return `${isoDate} ${pad2(H)}:${pad2(M)}:00`;
}

// "YYYY-MM-DD HH:mm:ss" (ili ISO) → "dd.mm.yyyy HH:mm"
export function mysqlDTToHuman(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`;
}

// datetime-local "YYYY-MM-DDTHH:mm" → "dd.mm.yyyy HH:mm"
export function datetimeLocalToHuman(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

// "YYYY-MM-DD HH:mm:ss" → datetime-local "YYYY-MM-DDTHH:mm"
export function mysqlDTToDatetimeLocal(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim().replace(" ", "T");
  // prihvati i ISO sa sekundama
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return "";
  return `${m[1]}T${m[2]}:${m[3]}`;
}

export function todayDDMMYYYY(): string {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
