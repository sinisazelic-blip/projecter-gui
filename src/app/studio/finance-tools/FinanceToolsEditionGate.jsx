"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFluxaEdition } from "@/components/FluxaEditionProvider";

/** Feature ID 75 = Finance Tools (samo Full i Compact). */
const FINANCE_TOOLS_FEATURE_ID = 75;

export default function FinanceToolsEditionGate({ children }) {
  const router = useRouter();
  const { isFeatureVisible, mounted } = useFluxaEdition();

  useEffect(() => {
    if (!mounted) return;
    if (!isFeatureVisible(FINANCE_TOOLS_FEATURE_ID)) {
      router.replace("/finance");
    }
  }, [mounted, isFeatureVisible, router]);

  if (!mounted) return null;
  if (!isFeatureVisible(FINANCE_TOOLS_FEATURE_ID)) return null;

  return children;
}
