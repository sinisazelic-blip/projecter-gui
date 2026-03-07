"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getPermission, canSee, canEdit, canUse, isReadOnly } from "@/lib/auth/permissions-matrix";

const AuthUserContext = createContext(null);

export function AuthUserProvider({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

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
      })
      .catch(() => {
        setUser(null);
        setSubscriptionExpired(false);
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  const nivo = user?.nivo ?? 0;

  const permission = useCallback(
    (module, inPage = "") => {
      return getPermission(module, inPage, nivo);
    },
    [nivo]
  );

  const value = {
    user,
    nivo,
    loading,
    subscriptionExpired,
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
