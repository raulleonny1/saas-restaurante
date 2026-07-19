"use client";

import { useAuth } from "@/context/AuthProvider";
import type { RoleId } from "@/types/rbac";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redirects when the signed-in user lacks one of the allowed roles. */
export function useRoleGuard(allowed: RoleId[]) {
  const { user, loading, hasAnyRole } = useAuth();
  const router = useRouter();
  const allowedAccess = hasAnyRole(allowed);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowedAccess) {
      router.replace("/dashboard");
    }
  }, [loading, user, allowedAccess, router]);

  return { allowed: allowedAccess, loading };
}
