"use client";

import { can as canPermission } from "@/lib/rbac";
import { resolveEffectivePermissions } from "@/lib/rbac/evaluate";
import {
  canManageRestaurant,
  hasAnyRole,
  hasRole,
  isStaff,
  resolveDisplayRole,
} from "@/lib/roles";
import {
  bindAuthProfileHook,
  reloadCurrentUser,
  signOut as doSignOut,
  subscribeAuth,
} from "@/services/auth.service";
import type { AppUser, AuthStatus } from "@/types/auth";
import type { PermissionId, RoleId } from "@/types/rbac";
import type { Member } from "@/types/restaurant";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TenantContext } from "./tenant-context";

interface AuthSessionValue {
  user: AppUser | null;
  status: AuthStatus;
  loading: boolean;
  signOut: () => Promise<void>;
}

interface AuthContextValue extends AuthSessionValue {
  role: RoleId | null;
  permissions: PermissionId[];
  member: Member | null;
  hasRole: (allowed: RoleId | RoleId[]) => boolean;
  hasAnyRole: (allowed: RoleId[]) => boolean;
  can: (permission: PermissionId) => boolean;
  isStaff: boolean;
  canManage: boolean;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    bindAuthProfileHook((next) => {
      setUser(next);
      setStatus("authenticated");
    });
    return () => bindAuthProfileHook(null);
  }, []);

  useEffect(() => {
    return subscribeAuth((next) => {
      setUser(next);
      setStatus(next ? "authenticated" : "unauthenticated");
    });
  }, []);

  const healUid = user?.uid ?? "";
  const healRestaurants = user?.restaurantIds?.join(",") ?? "";

  // Heal raced roles (profile and/or membership stamped as cliente)
  useEffect(() => {
    if (!healUid || !healRestaurants) return;
    let cancelled = false;
    void reloadCurrentUser()
      .then((fresh) => {
        if (cancelled || !fresh) return;
        setUser((prev) => {
          if (!prev) return fresh;
          if (fresh.role !== prev.role || fresh.updatedAt !== prev.updatedAt) {
            return fresh;
          }
          return prev;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [healUid, healRestaurants]);

  const value = useMemo<AuthSessionValue>(
    () => ({
      user,
      status,
      loading: status === "loading",
      signOut: async () => {
        await doSignOut();
        setUser(null);
        setStatus("unauthenticated");
      },
    }),
    [user, status],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

/** Session only (no tenant membership). Used by RestaurantProvider / TenantProvider. */
export function useAuthSession(): AuthSessionValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthProvider");
  return ctx;
}

/**
 * Auth + active-tenant membership.
 * Badge/permissions use the higher of profile vs membership (fixes cliente race).
 */
export function useAuth(): AuthContextValue {
  const session = useAuthSession();
  const tenant = useContext(TenantContext);

  return useMemo<AuthContextValue>(() => {
    const { user } = session;

    if (user?.isSuperAdmin) {
      const permissions = resolveEffectivePermissions({ roleId: "super_admin" });
      const permSet = new Set(permissions);
      return {
        ...session,
        role: "super_admin",
        permissions,
        member: tenant?.member ?? null,
        hasRole: (allowed) => hasRole("super_admin", allowed),
        hasAnyRole: (allowed) => hasAnyRole("super_admin", allowed),
        can: (permission) => canPermission(permSet, permission),
        isStaff: true,
        canManage: true,
      };
    }

    const memberRole =
      tenant?.ready && tenant.member?.active
        ? (tenant.member.roleId ?? tenant.member.role ?? tenant.role)
        : null;

    const role = resolveDisplayRole(user?.role, memberRole);

    // If membership was raced as cliente, don't use its empty permission cache
    const useMemberPerms =
      Boolean(tenant?.ready && tenant.member?.active) &&
      memberRole != null &&
      memberRole !== "cliente" &&
      role === memberRole;

    const permissions = useMemberPerms
      ? tenant!.permissions
      : role != null
        ? resolveEffectivePermissions({ roleId: role })
        : [];
    const permSet = new Set(permissions);

    return {
      ...session,
      role,
      permissions,
      member: tenant?.member ?? null,
      hasRole: (allowed) => hasRole(role ?? undefined, allowed),
      hasAnyRole: (allowed) => hasAnyRole(role ?? undefined, allowed),
      can: (permission) =>
        Boolean(user?.isSuperAdmin) || canPermission(permSet, permission),
      isStaff: isStaff(role ?? undefined),
      canManage: canManageRestaurant(role ?? undefined),
    };
  }, [session, tenant]);
}
