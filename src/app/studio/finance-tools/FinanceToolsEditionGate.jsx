"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";

/** Feature ID 75 = Finance Tools (samo Full i Compact). */
const FINANCE_TOOLS_FEATURE_ID = 75;

export default function FinanceToolsEditionGate({ children, allowEnter = false }) {
  const router = useRouter();
  const { isFeatureVisible, mounted } = useFluxaEdition();
  const allowed = allowEnter || isFeatureVisible(FINANCE_TOOLS_FEATURE_ID);

  useEffect(() => {
    if (!mounted) return;
    if (!allowed) {
      router.replace("/finance");
    }
  }, [mounted, allowed, router]);

  if (!mounted) return null;
  if (!allowed) return null;

  return children;
}
