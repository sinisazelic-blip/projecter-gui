/** Normalizacija statusa naplate fakture (kolona fakture.fiskalni_status). */

export function normalizeFiskalniStatus(val) {
  return String(val ?? "")
    .trim()
    .toUpperCase();
}

export function isFakturaPlacenaStatus(val) {
  const s = normalizeFiskalniStatus(val);
  return (
    s === "PLACENA" || s === "DJELIMICNO" || s === "PAID" || s === "PLACENO"
  );
}
