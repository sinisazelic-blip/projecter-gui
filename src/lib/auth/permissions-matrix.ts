/**
 * Matrica prava pristupa – generirano iz docs/Fluxa_docs/Fluxa prava pristupa i users.xlsx (sheet Pages).
 * Ne uređuj ručno; ponovo pokreni: node scripts/generate-permissions-from-excel.js
 */

export const LEVELS = [0, 1, 2, 3, 5, 6, 8, 9, 10] as const;
export type Level = (typeof LEVELS)[number];

export type Permission =
  | "demo"
  | "hide"
  | "Read Only"
  | "Show"
  | "Use"
  | "Edit"
  | "all";

export const PERMISSIONS_MATRIX: Record<
  string,
  Record<string, Partial<Record<Level, Permission>>>
> = {
  Dashboard: {
    "": {
      "0": "Show",
      "1": "Show",
      "2": "Show",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "Show",
      "9": "Show",
      "10": "all",
    },
  },
  "Mobile dashboard": {
    "-": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Finansiki pregled": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "Show",
      "9": "Show",
      "10": "all",
    },
  },
  Deals: {
    "-": {
      "1": "hide",
      "2": "hide",
      "3": "Read Only",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    filteri: {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "Use",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  Deal: {
    "-": {
      "1": "hide",
      "2": "hide",
      "3": "Read Only",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    storno: {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Timeline (Deal)": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Stavke - oređivanje budžeta": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Ukupno/budžet:": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Strategic Core": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Status (Deal)": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Podaci o klijentu/naručiocu": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Strategic Core": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  PP: {
    "-": {
      "0": "Show",
      "1": "hide",
      "2": "hide",
      "3": "Read Only",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    filteri: {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    Rok: {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Budžet-Troškovi-Zarada": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Budžet - pravo stanje u opisu": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    Status: {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  Projekat: {
    "-": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Basics (ime, timeline status, semafor, rok)": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "owner semafor": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "budžet limit show": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    ProBono: {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Owner obračun zarade": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Faze Show/Edit": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Edit",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Final OK": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Use",
      "6": "Use",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    Storno: {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Grupa Finansije": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Budžet - info stvarnog iznosa": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    Napomenta: {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Show",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Dodaj trošak": {
      "1": "hide",
      "2": "hide",
      "3": "Edit",
      "5": "Edit",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Troškovi stavke": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Troškovi stavke/edit": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Troškovi stavke/edit/finansije": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
    "Troškovi stavke/storno prikaži": {
      "1": "hide",
      "2": "hide",
      "3": "Show",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  Fakture: {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "all",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  Naplate: {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "all",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Finansije - Potraživanja": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "all",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Finansije - Dugovanja": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "all",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Finansije - Banka": {
    "": {
      "1": "hide",
      "2": "Read Only",
      "3": "hide",
      "5": "Read Only",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Finansije - Početno stanje": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "hide",
      "9": "all",
      "10": "all",
    },
  },
  "Finansije - Otpis": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "hide",
      "9": "all",
      "10": "all",
    },
  },
  Blagajna: {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "hide",
      "9": "hide",
      "10": "all",
    },
  },
  "Šifarnici - Klijenti": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Edit",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Dobavljači": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Edit",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Saradnici": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Radnici": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Cjenovnik": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Edit",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Faze": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "Show",
      "6": "Edit",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Users": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Šifarnici - Roles": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  "Firma (postavke, logo)": {
    "": {
      "1": "hide",
      "2": "hide",
      "3": "hide",
      "5": "hide",
      "6": "hide",
      "8": "all",
      "9": "all",
      "10": "all",
    },
  },
  Izvještaji: {
    "": {
      "1": "hide",
      "2": "Read Only",
      "3": "hide",
      "5": "Show",
      "6": "hide",
      "8": "Show",
      "9": "Show",
      "10": "all",
    },
  },
};

function nearestLevel(level: number): Level {
  const n = Number(level);
  if (LEVELS.includes(n as Level)) return n as Level;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (LEVELS[i] <= n) return LEVELS[i];
  }
  return 1;
}

export function getPermission(
  module: string,
  inPage: string,
  userLevel: number,
): Permission {
  const mod = PERMISSIONS_MATRIX[module];
  if (!mod) return "hide";
  const key = inPage;
  const row = mod[key] ?? mod[""] ?? mod["-"];
  if (!row) return "hide";
  const level = nearestLevel(userLevel);
  const perm = (row as Record<string, string>)[String(level)];
  return (perm as Permission) || "hide";
}

export function canSee(perm: Permission): boolean {
  return perm !== "hide" && perm !== "demo";
}

export function canEdit(perm: Permission): boolean {
  return perm === "Edit" || perm === "all";
}

export function canUse(perm: Permission): boolean {
  return perm === "Use" || perm === "Edit" || perm === "all";
}

export function isReadOnly(perm: Permission): boolean {
  return perm === "Read Only" || perm === "Show";
}
