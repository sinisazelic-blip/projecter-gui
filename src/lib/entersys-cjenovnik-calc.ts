import { resolveEnterSysBasePackageId } from "@/lib/entersys-activation";

export type EnterSysCjenovnikVrsta = "PAKET" | "DODATAK" | "EVENT";

export type EnterSysCjenovnikRow = {
  stavka_key: string;
  naziv: string;
  module_key: string | null;
  vrsta: EnterSysCjenovnikVrsta;
  cijena_bam: number;
  cijena_eur: number;
  cijena_usd: number;
  sort_order: number;
  aktivan: number;
};

export function normalizeEnterSysCurrency(
  raw: string | null | undefined,
): "BAM" | "EUR" | "USD" {
  const c = String(raw ?? "KM").trim().toUpperCase();
  if (c === "EUR") return "EUR";
  if (c === "USD") return "USD";
  return "BAM";
}

export function displayEnterSysCurrency(code: "BAM" | "EUR" | "USD"): string {
  if (code === "BAM") return "KM";
  return code;
}

export function amountForCurrency(
  row: Pick<EnterSysCjenovnikRow, "cijena_bam" | "cijena_eur" | "cijena_usd">,
  currency: string | null | undefined,
): number {
  const code = normalizeEnterSysCurrency(currency);
  if (code === "EUR") return Number(row.cijena_eur) || 0;
  if (code === "USD") return Number(row.cijena_usd) || 0;
  return Number(row.cijena_bam) || 0;
}

export function parseEnterSysModuleKeys(
  scope: string | null | undefined,
): string[] {
  return String(scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type EnterSysPriceBreakdown = {
  total: number;
  currency: "BAM" | "EUR" | "USD";
  displayCurrency: string;
  lines: { key: string; naziv: string; amount: number }[];
};

export function calculateEnterSysMonthly(input: {
  packageId?: string | null;
  moduleKeys: string[];
  currency?: string | null;
  catalog: EnterSysCjenovnikRow[];
}): EnterSysPriceBreakdown {
  const currency = normalizeEnterSysCurrency(input.currency);
  const displayCurrency = displayEnterSysCurrency(currency);
  const catalog = (input.catalog ?? []).filter((r) => Number(r.aktivan) === 1);
  const byKey = new Map(catalog.map((r) => [r.stavka_key, r]));
  const byModule = new Map(
    catalog.filter((r) => r.module_key).map((r) => [String(r.module_key), r]),
  );

  const packageId = String(input.packageId ?? "").trim().toUpperCase() || null;
  const modules = new Set(input.moduleKeys);
  const lines: EnterSysPriceBreakdown["lines"] = [];
  const billed = new Set<string>();

  const addLine = (row: EnterSysCjenovnikRow) => {
    if (billed.has(row.stavka_key)) return;
    billed.add(row.stavka_key);
    lines.push({
      key: row.stavka_key,
      naziv: row.naziv,
      amount: amountForCurrency(row, currency),
    });
  };

  const base = packageId ? byKey.get(packageId) : null;
  if (base && base.vrsta === "PAKET") addLine(base);

  for (const mod of modules) {
    const row = byModule.get(mod);
    if (!row || Number(row.aktivan) !== 1) continue;
    if (row.vrsta === "EVENT") continue;
    if (base && row.stavka_key === base.stavka_key) continue;
    if (base && row.module_key === "enterCore") continue;
    addLine(row);
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { total, currency, displayCurrency, lines };
}

export function calculateEnterSysMonthlyForTenant(
  tenant: {
    soccs_tier?: string | null;
    soccs_platform_scope?: string | null;
    currency?: string | null;
    status?: string | null;
  },
  catalog: EnterSysCjenovnikRow[],
): EnterSysPriceBreakdown & { billedTotal: number; isPilot: boolean } {
  const packageId = resolveEnterSysBasePackageId(tenant);
  const calc = calculateEnterSysMonthly({
    packageId,
    moduleKeys: parseEnterSysModuleKeys(tenant.soccs_platform_scope),
    currency: tenant.currency,
    catalog,
  });
  const isPilot = String(tenant.status ?? "").trim().toUpperCase() === "PILOT";
  return {
    ...calc,
    isPilot,
    billedTotal: isPilot ? 0 : calc.total,
  };
}
