"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser } from "@/components/AuthUserProvider";

const ALLOWED_PATHS = ["/", "/subscription-expired", "/studio/licence"];

function isAllowed(path) {
  if (!path) return true;
  return ALLOWED_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export default function SubscriptionGuard({ children }) {
  const { user, loading, subscriptionExpired } = useAuthUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !subscriptionExpired) return;
    if (isAllowed(pathname)) return;
    router.replace("/subscription-expired");
  }, [loading, user, subscriptionExpired, pathname, router]);

  return children;
}
