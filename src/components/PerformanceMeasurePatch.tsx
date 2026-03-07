"use client";

import { useEffect } from "react";

/**
 * Patch za poznatu Next.js grešku: performance.measure() ponekad baca
 * "cannot have a negative time stamp" (npr. pri navigaciji / 404).
 * Hvatamo tu grešku i ignorišemo je da ne ruši UI.
 * @see https://github.com/vercel/next.js/issues/86060
 */
export default function PerformanceMeasurePatch() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const perf = window.performance;
    if (!perf || typeof perf.measure !== "function" || (perf as any).__measurePatched) return;

    const original = perf.measure.bind(perf);
    (perf as any).measure = function (...args: unknown[]) {
      try {
        return original.apply(perf, args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("negative time stamp")) return null;
        throw err;
      }
    };
    (perf as any).__measurePatched = true;
  }, []);

  return null;
}
