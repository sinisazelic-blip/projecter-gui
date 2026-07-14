"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPermission, canSee, canEdit, canUse, isReadOnly } from "@/lib/auth/permissions-matrix";
import { mayAccessPath, isPublicPath } from "@/lib/auth/route-permission";
import {
  findAclModuleByMatrix,
  aclCanSee,
  aclCanEdit,
} from "@/lib/auth/acl-catalog";

const AuthUserContext = createContext(null);

export function AuthUserProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
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
    const isOwner = user.user_id === 0 || user.username === "Owner" || nivo >= 10;
    if (isOwner) return;
    const aclMap = user.acl && Object.keys(user.acl).length > 0 ? user.acl : null;
    if (!mayAccessPath(pathname, nivo, aclMap)) {
      router.replace("/dashboard");
    }
  }, [loading, user, pathname, router]);

  const nivo = user?.nivo ?? 0;
  const aclMap =
    user?.acl && typeof user.acl === "object" && Object.keys(user.acl).length > 0
      ? user.acl
      : null;

  const resolveAccess = useCallback(
    (module, inPage = "") => {
      if (nivo >= 10) return "edit";
      if (aclMap) {
        const aclMod = findAclModuleByMatrix(module, inPage);
        if (aclMod) return aclMap[aclMod.key] ?? "none";
      }
      return null;
    },
    [nivo, aclMap],
  );

  const permission = useCallback(
    (module, inPage = "") => {
      const access = resolveAccess(module, inPage);
      if (access === "edit") return "Edit";
      if (access === "view") return "Read Only";
      if (access === "none") return "hide";
      return getPermission(module, inPage, nivo);
    },
    [nivo, resolveAccess],
  );

  const completeOnboarding = useCallback(async () => {
    setForceShowTourOnce(false);
    setOnboardingCompleted(true);
    try {
      await fetch("/api/auth/onboarding-complete", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
  }, []);

  const requestTourOnce = useCallback(() => {
    setForceShowTourOnce(true);
  }, []);

  const value = {
    user,
    nivo,
    acl: aclMap,
    loading,
    subscriptionExpired,
    onboardingCompleted,
    completeOnboarding,
    requestTourOnce,
    forceShowTourOnce,
    permission,
    canSee: (module, inPage) => {
      if (nivo >= 10) return true;
      const access = resolveAccess(module, inPage);
      if (access != null) return aclCanSee(access);
      return canSee(permission(module, inPage));
    },
    canEdit: (module, inPage) => {
      if (nivo >= 10) return true;
      const access = resolveAccess(module, inPage);
      if (access != null) return aclCanEdit(access);
      return canEdit(permission(module, inPage));
    },
    canUse: (module, inPage) => {
      if (nivo >= 10) return true;
      const access = resolveAccess(module, inPage);
      if (access != null) return aclCanEdit(access) || aclCanSee(access);
      return canUse(permission(module, inPage));
    },
    isReadOnly: (module, inPage) => {
      if (nivo >= 10) return false;
      const access = resolveAccess(module, inPage);
      if (access != null) return access === "view";
      return isReadOnly(permission(module, inPage));
    },
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
    acl: null,
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

export function usePermission(module, inPage = "") {
  const { permission } = useAuthUser();
  return permission(module, inPage);
}
