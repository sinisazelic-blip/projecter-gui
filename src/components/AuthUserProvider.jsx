"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPermission, canSee, canEdit, canUse, isReadOnly } from "@/lib/auth/permissions-matrix";
import { mayAccessPath, isPublicPath } from "@/lib/auth/route-permission";

const AuthUserContext = createContext(null);

export function AuthUserProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true); // default true so tour doesn't flash before me loads
  const [forceShowTourOnce, setForceShowTourOnce] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.text())
      .then((text) => {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      })
      .then((data) => {
        setUser(data?.user ?? null);
        setSubscriptionExpired(!!data?.subscription_expired);
        setOnboardingCompleted(!!data?.onboarding_completed);
      })
      .catch(() => {
        setUser(null);
        setSubscriptionExpired(false);
        setOnboardingCompleted(true);
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  useEffect(() => {
    if (loading || !user) return;
    if (isPublicPath(pathname)) return;
    const nivo = user.nivo ?? 0;
    const isOwner = user.user_id === 0 || user.username === "Owner";
    if (isOwner) return;
    if (!mayAccessPath(pathname, nivo)) {
      router.replace("/dashboard");
    }
  }, [loading, user, pathname, router]);

  const nivo = user?.nivo ?? 0;

  const permission = useCallback(
    (module, inPage = "") => {
      return getPermission(module, inPage, nivo);
    },
    [nivo]
  );

  const completeOnboarding = useCallback(async () => {
    setForceShowTourOnce(false);
    setOnboardingCompleted(true);
    try {
      await fetch("/api/auth/onboarding-complete", { method: "POST", credentials: "include" });
    } catch {
      // Tura se sakriva odmah; nakon reloada ostaje sakrivena samo ako postoji onboarding_completed tabela
    }
  }, []);

  const requestTourOnce = useCallback(() => {
    setForceShowTourOnce(true);
  }, []);

  const value = {
    user,
    nivo,
    loading,
    subscriptionExpired,
    onboardingCompleted,
    completeOnboarding,
    requestTourOnce,
    forceShowTourOnce,
    permission,
    canSee: (module, inPage) => nivo >= 10 || canSee(permission(module, inPage)),
    canEdit: (module, inPage) => nivo >= 10 || canEdit(permission(module, inPage)),
    canUse: (module, inPage) => nivo >= 10 || canUse(permission(module, inPage)),
    isReadOnly: (module, inPage) => nivo >= 10 ? false : isReadOnly(permission(module, inPage)),
  };

  return (
    <AuthUserContext.Provider value={value}>
      {children}
    </AuthUserContext.Provider>
  );
}

export function useAuthUser() {
  const ctx = useContext(AuthUserContext);
  return ctx ?? {
    user: null,
    nivo: 0,
    loading: false,
    subscriptionExpired: false,
    onboardingCompleted: true,
    completeOnboarding: async () => {},
    requestTourOnce: () => {},
    forceShowTourOnce: false,
    permission: () => "hide",
    canSee: () => false,
    canEdit: () => false,
    canUse: () => false,
    isReadOnly: () => true,
  };
}

/** Za provjeru prava po modulu/in-page iz Excela. Vraća: "demo" | "hide" | "Read Only" | "Show" | "Use" | "Edit" | "all" */
export function usePermission(module, inPage = "") {
  const { permission } = useAuthUser();
  return permission(module, inPage);
}
