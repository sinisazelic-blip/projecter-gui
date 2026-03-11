/**
 * Mapiranje pathname → (module, inPage) za zaštitu ruta.
 * Ako korisnik nema pravo "vidjeti" modul (hide/demo), ne smije pristupiti ni ručnim upisom linka.
 */

import { getPermission, canSee } from "./permissions-matrix";

/** Nivo 0 = Saradnik: smije samo Dashboard i PP (projekti u kojima učestvuje). */
export const SARADNIK_NIVO = 0;

/** Pathovi koji ne zahtijevaju provjeru permisije (javni ili posebni). */
const PUBLIC_OR_SPECIAL = ["/", "/subscription-expired", "/demo"];

/** Prefixi koji su uvijek dozvoljeni (npr. API, _next, static). Ne koristi se u AuthUserProvider. */
export function isPublicPath(pathname: string): boolean {
  if (!pathname) return true;
  return PUBLIC_OR_SPECIAL.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Lista path → { module, inPage } za sve zaštićene rute.
 * Redoslijed: specifičnije rute prvo (npr. /finance/banka prije /finance).
 */
const ROUTE_TO_MODULE: { path: string; module: string; inPage: string }[] = [
  { path: "/dashboard", module: "Dashboard", inPage: "" },
  { path: "/inicijacije", module: "Deals", inPage: "-" },
  { path: "/studio/strategic-core", module: "Strategic Core", inPage: "" },
  { path: "/projects", module: "PP", inPage: "-" },
  { path: "/projects/", module: "Projekat", inPage: "-" },
  { path: "/fakture", module: "Fakture", inPage: "" },
  { path: "/naplate", module: "Naplate", inPage: "" },
  { path: "/finance/prihodi", module: "Finansije - Potraživanja", inPage: "" },
  { path: "/finance/dugovanja", module: "Finansije - Dugovanja", inPage: "" },
  { path: "/finance/banka", module: "Finansije - Banka", inPage: "" },
  { path: "/finance/pocetna-stanja", module: "Finansije - Početno stanje", inPage: "" },
  { path: "/finance/otpis", module: "Finansije - Otpis", inPage: "" },
  { path: "/finance/placanja", module: "Finansije - Dugovanja", inPage: "" },
  { path: "/finance/potrazivanja", module: "Finansije - Potraživanja", inPage: "" },
  { path: "/finance/krediti", module: "Finansije - Dugovanja", inPage: "" },
  { path: "/finance/kuf", module: "Finansije - Početno stanje", inPage: "" },
  { path: "/finance/pdv", module: "Finansije - Dugovanja", inPage: "" },
  { path: "/finance/cashflow", module: "Finansije - Banka", inPage: "" },
  { path: "/finance/banka-vs-knjige", module: "Finansije - Banka", inPage: "" },
  { path: "/finance/fiksni-troskovi", module: "Finansije - Dugovanja", inPage: "" },
  { path: "/finance/profit", module: "Izvještaji", inPage: "" },
  { path: "/finance", module: "Finansije - Potraživanja", inPage: "" },
  { path: "/cash", module: "Blagajna", inPage: "" },
  { path: "/mobile", module: "Mobile dashboard", inPage: "-" },
  { path: "/studio/klijenti", module: "Šifarnici - Klijenti", inPage: "" },
  { path: "/studio/talenti", module: "Šifarnici - Talenti", inPage: "" },
  { path: "/studio/dobavljaci", module: "Šifarnici - Dobavljači", inPage: "" },
  { path: "/studio/cjenovnik", module: "Šifarnici - Cjenovnik", inPage: "" },
  { path: "/studio/radnici", module: "Šifarnici - Radnici", inPage: "" },
  { path: "/studio/radne-faze", module: "Šifarnici - Faze", inPage: "" },
  { path: "/studio/users", module: "Šifarnici - Users", inPage: "" },
  { path: "/studio/roles", module: "Šifarnici - Roles", inPage: "" },
  { path: "/studio/firma", module: "Firma (postavke, logo)", inPage: "" },
  { path: "/studio/finance-tools", module: "Finansije - Banka", inPage: "" },
  { path: "/studio/licence", module: "Šifarnici - Users", inPage: "" },
  { path: "/studio", module: "Šifarnici - Klijenti", inPage: "" },
  { path: "/izvjestaji", module: "Izvještaji", inPage: "" },
  { path: "/izvodi", module: "Finansije - Banka", inPage: "" },
  { path: "/narudzbenice", module: "Fakture", inPage: "" },
  { path: "/ponude", module: "Deals", inPage: "-" },
  { path: "/banking", module: "Finansije - Banka", inPage: "" },
];

function getModuleForPath(pathname: string): { module: string; inPage: string } | null {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  for (const { path: p, module: mod, inPage } of ROUTE_TO_MODULE) {
    if (path === p || (p.endsWith("/") && path.startsWith(p)) || (!p.endsWith("/") && path.startsWith(p + "/"))) {
      return { module: mod, inPage };
    }
  }
  return null;
}

/**
 * Da li korisnik smije pristupiti datoj ruti?
 * - Javni pathovi: da.
 * - Saradnik (nivo 0): samo /dashboard i /projects (i /projects/[id]).
 * - Ostalo: prema matrici; ako hide ili demo → ne.
 */
/** Nivo 10 = owner / full admin: pristup svim rutama. */
const OWNER_NIVO = 10;

export function mayAccessPath(pathname: string, nivo: number): boolean {
  if (isPublicPath(pathname)) return true;
  if (nivo >= OWNER_NIVO) return true;

  if (nivo === SARADNIK_NIVO) {
    if (pathname === "/dashboard") return true;
    if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
    return false;
  }

  const map = getModuleForPath(pathname);
  if (!map) return true;
  const perm = getPermission(map.module, map.inPage, nivo);
  return canSee(perm);
}
