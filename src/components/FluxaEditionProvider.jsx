"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { isVisibleInEdition, FLUXA_EDITIONS } from "@/lib/fluxa-edition";

const STORAGE_KEY_EDITION = "fluxa_edition";
const STORAGE_KEY_OWNER = "FLUXA_OWNER_TOKEN";

const FluxaEditionContext = createContext(null);

export function FluxaEditionProvider({ children }) {
  const [edition, setEditionState] = useState("Full");
  const [isOwner, setIsOwner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const owner = !!window.localStorage.getItem(STORAGE_KEY_OWNER);
    setIsOwner(owner);
    if (owner) {
      const saved = window.localStorage.getItem(STORAGE_KEY_EDITION);
      if (saved && FLUXA_EDITIONS.includes(saved)) setEditionState(saved);
    }
    setMounted(true);
  }, []);

  const setEdition = useCallback((value) => {
    if (!FLUXA_EDITIONS.includes(value)) return;
    setEditionState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_EDITION, value);
    }
  }, []);

  const effectiveEdition = isOwner ? edition : "Full";

  const isFeatureVisible = useCallback(
    (featureId) => {
      if (!mounted) return true;
      return isVisibleInEdition(Number(featureId), effectiveEdition);
    },
    [effectiveEdition, mounted]
  );

  const value = {
    edition,
    setEdition,
    isOwner,
    isFeatureVisible,
    mounted,
  };

  return (
    <FluxaEditionContext.Provider value={value}>
      {children}
    </FluxaEditionContext.Provider>
  );
}

export function useFluxaEdition() {
  const ctx = useContext(FluxaEditionContext);
  if (!ctx) {
    return {
      edition: "Full",
      setEdition: () => {},
      isOwner: false,
      isFeatureVisible: () => true,
      mounted: true,
    };
  }
  return ctx;
}
