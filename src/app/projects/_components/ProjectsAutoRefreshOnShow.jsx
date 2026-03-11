"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Next App Router zna vratiti keširanu verziju stranice pri Back/Forward navigaciji.
 * To može ostaviti zastario status u PP listi (npr. ostane "Deal" iako je status promijenjen u projektu).
 * Ovaj helper radi `router.refresh()` kada se stranica ponovo prikaže / dobije fokus.
 */
export default function ProjectsAutoRefreshOnShow() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const minGapMs = 1200;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < minGapMs) return;
      lastRefreshAtRef.current = now;
      router.refresh();
    };

    // ✅ Prvi mount: povuci svježe podatke (izbjegava scenario gdje event ne okine refresh)
    const t0 = window.setTimeout(() => refresh(), 50);

    const onPageShow = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(t0);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  return null;
}

