/**
 * Čita docs/Fluxa prava pristupa i users.xlsx, sheet "Pages",
 * i generira src/lib/auth/permissions-matrix.ts
 */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const excelPath = path.join(__dirname, "../docs/Fluxa prava pristupa i users.xlsx");
const outPath = path.join(__dirname, "../src/lib/auth/permissions-matrix.ts");

const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets["Pages"];
if (!sheet) throw new Error("Sheet 'Pages' not found");
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

const LEVELS = [1, 2, 3, 5, 6, 8, 9, 10];
const HEADER_ROW = 0;
const colToLevel = { 2: 1, 3: 2, 4: 3, 5: 5, 6: 6, 7: 8, 8: 9, 9: 10 };

const matrix = {};
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 2) continue;
  const moduleName = String(row[0] ?? "").trim();
  const inPage = String(row[1] ?? "").trim();
  if (!moduleName) continue;
  if (!matrix[moduleName]) matrix[moduleName] = {};
  const perLevel = {};
  for (let col = 2; col <= 9; col++) {
    const level = colToLevel[col];
    const val = String(row[col] ?? "").trim() || "hide";
    perLevel[level] = val;
  }
  matrix[moduleName][inPage] = perLevel;
}

const tsContent = `/**
 * Matrica prava pristupa – generirano iz docs/Fluxa prava pristupa i users.xlsx (sheet Pages).
 * Ne uređuj ručno; ponovo pokreni: node scripts/generate-permissions-from-excel.js
 */

export const LEVELS = [1, 2, 3, 5, 6, 8, 9, 10] as const;
export type Level = (typeof LEVELS)[number];

export type Permission = "demo" | "hide" | "Read Only" | "Show" | "Use" | "Edit" | "all";

export const PERMISSIONS_MATRIX: Record<string, Record<string, Partial<Record<Level, Permission>>>> = ${JSON.stringify(matrix, null, 2)};

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
  userLevel: number
): Permission {
  const mod = PERMISSIONS_MATRIX[module];
  if (!mod) return "hide";
  const key = inPage;
  const row = mod[key] ?? mod[""] ?? mod["-"];
  if (!row) return "hide";
  const level = nearestLevel(userLevel);
  const perm = row[level as Level];
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
`;

fs.writeFileSync(outPath, tsContent, "utf8");
console.log("Written", outPath);
