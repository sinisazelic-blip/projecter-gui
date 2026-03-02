"use client";

import { useFluxaEdition } from "@/components/FluxaEditionProvider";

/**
 * Prikazuje children samo ako je feature vidljiv u trenutnoj verziji Fluxe.
 * @param {number} id - ID iz Excela (docs/Fluxa Compact vs Light vs Core.xlsx)
 */
export function FluxaFeature({ id, children }) {
  const { isFeatureVisible } = useFluxaEdition();
  if (!isFeatureVisible(id)) return null;
  return children;
}
