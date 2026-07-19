"use client";

import { can as canPermission } from "@/lib/rbac";
import { resolveEffectivePermissions } from "@/lib/rbac/evaluate";
import { canManageRestaurant, hasAnyRole, hasRole, isStaff } from "@/lib/roles";
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

  // Heal raced "cliente" profiles that own restaurants (badge / permissions)
  useEffect(() => {
    if (!user || user.role !== "cliente" || !user.restaurantIds?.length) {
      return;
    }
    let cancelled = false;
    void reloadCurrentUser().then((fresh) => {
      if (!cancelled && fresh && fresh.role !== "cliente") {
        setUser(fresh);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
 * Permissions come from members/{uid} when available; otherwise global users.role.
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

    // Prefer per-restaurant membership when TenantProvider is ready with a member
    if (tenant?.ready && tenant.member?.active) {
      return {
        ...session,
        role: tenant.role,
        permissions: tenant.permissions,
        member: tenant.member,
        hasRole: tenant.hasRole,
        hasAnyRole: tenant.hasAnyRole,
        can: tenant.can,
        isStaff: tenant.isStaff,
        canManage: tenant.canManage,
      };
    }

    // Fallback: global profile role (cliente, or before membership loads)
    const role = user?.role ?? null;
    const permissions =
      role != null
        ? resolveEffectivePermissions({ roleId: role })
        : [];
    const permSet = new Set(permissions);

    return {
      ...session,
      role,
      permissions,
      member: tenant?.member ?? null,
      hasRole: (allowed) => hasRole(user?.role, allowed),
      hasAnyRole: (allowed) => hasAnyRole(user?.role, allowed),
      can: (permission) => canPermission(permSet, permission),
      isStaff: isStaff(user?.role),
      canManage: canManageRestaurant(user?.role),
    };
  }, [session, tenant]);
}
