export type FluxaInstance = "STUDIO" | "ENTER";

/** Studio TAF vs Enter Fluxa — dva vrata, isti kostur. Default STUDIO. */
export function getFluxaInstance(): FluxaInstance {
  const raw = String(
    process.env.FLUXA_INSTANCE || process.env.NEXT_PUBLIC_FLUXA_INSTANCE || "STUDIO",
  )
    .trim()
    .toUpperCase();
  if (raw === "ENTER" || raw === "ENTERFLUXA" || raw === "ENTER_FLUXA") {
    return "ENTER";
  }
  return "STUDIO";
}

export function isEnterInstance(): boolean {
  return getFluxaInstance() === "ENTER";
}
