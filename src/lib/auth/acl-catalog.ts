/**
 * Katalog modula za granularni ACL (view / edit / none).
 * moduleKey se koristi u bazi; matrixModule (+ inPage) mapira na staru matricu i PermissionGate.
 */

export type AclAccess = "none" | "view" | "edit";

export type AclModuleDef = {
  key: string;
  labelSr: string;
  labelEn: string;
  /** Ključ koji šalje PermissionGate / route-permission (običan space, ne NBSP). */
  matrixModule: string;
  matrixInPage: string;
  group: "desk" | "finance" | "reports" | "master" | "system";
  /** Owner-only po defaultu (npr. Banka kao privatni novčanik). */
  ownerOnlyDefault?: boolean;
};

export const ACL_MODULES: AclModuleDef[] = [
  { key: "dashboard", labelSr: "Dashboard", labelEn: "Dashboard", matrixModule: "Dashboard", matrixInPage: "", group: "desk" },
  { key: "deals", labelSr: "Deals", labelEn: "Deals", matrixModule: "Deals", matrixInPage: "-", group: "desk" },
  { key: "strategic_core", labelSr: "Strategic Core", labelEn: "Strategic Core", matrixModule: "Strategic Core", matrixInPage: "", group: "desk" },
  { key: "pp", labelSr: "Project Portfolio", labelEn: "Project Portfolio", matrixModule: "PP", matrixInPage: "-", group: "desk" },
  { key: "projekat", labelSr: "Projekat", labelEn: "Project", matrixModule: "Projekat", matrixInPage: "-", group: "desk" },

  { key: "fakture", labelSr: "Fakture", labelEn: "Invoices", matrixModule: "Fakture", matrixInPage: "", group: "finance" },
  { key: "naplate", labelSr: "Naplata", labelEn: "Collections", matrixModule: "Naplate", matrixInPage: "", group: "finance" },
  { key: "pdv", labelSr: "PDV", labelEn: "VAT", matrixModule: "Finansije - PDV", matrixInPage: "", group: "finance" },
  { key: "kif", labelSr: "KIF", labelEn: "Sales ledger", matrixModule: "Finansije - KIF", matrixInPage: "", group: "finance" },
  { key: "kuf", labelSr: "KUF", labelEn: "Purchase ledger", matrixModule: "Finansije - KUF", matrixInPage: "", group: "finance" },
  { key: "izvodi", labelSr: "Izvodi", labelEn: "Bank statements", matrixModule: "Finansije - Izvodi", matrixInPage: "", group: "finance" },
  { key: "potrazivanja", labelSr: "Potraživanja / Prihodi", labelEn: "Receivables", matrixModule: "Finansije - Potraživanja", matrixInPage: "", group: "finance" },
  { key: "dugovanja", labelSr: "Dugovanja / Troškovi", labelEn: "Payables / Costs", matrixModule: "Finansije - Dugovanja", matrixInPage: "", group: "finance" },
  { key: "banka", labelSr: "Banka (novčanik)", labelEn: "Bank (wallet)", matrixModule: "Finansije - Banka", matrixInPage: "", group: "finance", ownerOnlyDefault: true },
  { key: "blagajna", labelSr: "Blagajna", labelEn: "Cash desk", matrixModule: "Blagajna", matrixInPage: "", group: "finance" },
  { key: "otpis", labelSr: "Otpis", labelEn: "Write-off", matrixModule: "Finansije - Otpis", matrixInPage: "", group: "finance" },
  { key: "pocetna_stanja", labelSr: "Početna stanja", labelEn: "Opening balances", matrixModule: "Finansije - Početno stanje", matrixInPage: "", group: "finance" },
  { key: "rasknjizavanje", labelSr: "Rasknjižavanje", labelEn: "Bank allocation", matrixModule: "Finansije - Banka", matrixInPage: "", group: "finance" },

  { key: "izvjestaji", labelSr: "Izvještaji / Profit", labelEn: "Reports / Profit", matrixModule: "Izvještaji", matrixInPage: "", group: "reports" },

  { key: "klijenti", labelSr: "Klijenti", labelEn: "Clients", matrixModule: "Šifarnici - Klijenti", matrixInPage: "", group: "master" },
  { key: "saradnici", labelSr: "Saradnici", labelEn: "Collaborators", matrixModule: "Šifarnici - Saradnici", matrixInPage: "", group: "master" },
  { key: "dobavljaci", labelSr: "Dobavljači", labelEn: "Vendors", matrixModule: "Šifarnici - Dobavljači", matrixInPage: "", group: "master" },
  { key: "cjenovnik", labelSr: "Cjenovnik", labelEn: "Price list", matrixModule: "Šifarnici - Cjenovnik", matrixInPage: "", group: "master" },
  { key: "radnici", labelSr: "Radnici", labelEn: "Staff", matrixModule: "Šifarnici - Radnici", matrixInPage: "", group: "master" },
  { key: "faze", labelSr: "Radne faze", labelEn: "Work phases", matrixModule: "Šifarnici - Faze", matrixInPage: "", group: "master" },
  { key: "firma", labelSr: "Firma", labelEn: "Company", matrixModule: "Firma (postavke, logo)", matrixInPage: "", group: "master" },

  { key: "users", labelSr: "Korisnici", labelEn: "Users", matrixModule: "Šifarnici - Users", matrixInPage: "", group: "system" },
  { key: "roles", labelSr: "Uloge", labelEn: "Roles", matrixModule: "Šifarnici - Roles", matrixInPage: "", group: "system" },
  { key: "mobile", labelSr: "Mobile dashboard", labelEn: "Mobile dashboard", matrixModule: "Mobile dashboard", matrixInPage: "-", group: "system" },
];

/** Šablon: računovodstvo — PDV, KIF/KUF, izvodi (bez novčanika / fakturisanja). */
export const ACL_TEMPLATE_RACUNOVODSTVO: Record<string, AclAccess> = {
  dashboard: "view",
  pdv: "edit",
  kif: "edit",
  kuf: "edit",
  izvodi: "edit",
  dugovanja: "edit",
  pocetna_stanja: "edit",
  potrazivanja: "view",
  izvjestaji: "view",
  naplate: "view",
};

export function normalizeAclModuleName(name: string): string {
  return String(name ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findAclModuleByMatrix(
  matrixModule: string,
  matrixInPage = "",
): AclModuleDef | null {
  const mod = normalizeAclModuleName(matrixModule);
  const inPage = String(matrixInPage ?? "");
  return (
    ACL_MODULES.find(
      (m) =>
        normalizeAclModuleName(m.matrixModule) === mod &&
        m.matrixInPage === inPage,
    ) ??
    ACL_MODULES.find((m) => normalizeAclModuleName(m.matrixModule) === mod) ??
    null
  );
}

export type UserAclMap = Record<string, AclAccess>;

export function aclCanSee(access: AclAccess | undefined): boolean {
  return access === "view" || access === "edit";
}

export function aclCanEdit(access: AclAccess | undefined): boolean {
  return access === "edit";
}
