"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global F1 → /uputstvo. Ne reaguje kada je fokus u input/textarea (da ne prekine kucanje).
 */
export default function UputstvoShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "F1") return;
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      router.push("/uputstvo");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
