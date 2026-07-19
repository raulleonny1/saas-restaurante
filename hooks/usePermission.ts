"use client";

import { useAuth } from "@/context/AuthProvider";
import type { PermissionId } from "@/types/rbac";

/** Check one or many permissions against the effective RBAC set. */
export function usePermission(permission: PermissionId | PermissionId[]) {
  const { can } = useAuth();
  const list = Array.isArray(permission) ? permission : [permission];
  return {
    allowed: list.every((p) => can(p)),
    allowedAny: list.some((p) => can(p)),
  };
}
