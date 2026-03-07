"use client";

import { useAuthUser } from "@/components/AuthUserProvider";

/**
 * Prikazuje children samo ako korisnik ima pravo "vidjeti" (Show, Use, Edit, all – ne hide/demo).
 * Modul i inPage moraju odgovarati sheetu "Pages" u docs/Fluxa prava pristupa i users.xlsx.
 */
export function PermissionGate({ module, inPage = "", children }) {
  const { canSee } = useAuthUser();
  if (!canSee(module, inPage)) return null;
  return children;
}
