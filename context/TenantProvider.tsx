"use client";

import { can as canPermission } from "@/lib/rbac";
import { resolveEffectivePermissions } from "@/lib/rbac/evaluate";
import { canManageRestaurant, hasAnyRole, hasRole, isStaff } from "@/lib/roles";
import { PERMISSION_CATALOG_VERSION } from "@/types/rbac";
import {
  ensureTenantBilling,
  subscribeBilling,
  subscribeInvoices,
} from "@/modules/tenant/services/billing.service";
import { subscribeBranches } from "@/modules/tenant/services/branches.service";
import {
  acceptPendingInvites,
  subscribeMember,
  subscribeMembers,
} from "@/modules/tenant/services/members.service";
import { reloadCurrentUser } from "@/services/auth.service";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuthSession } from "./AuthProvider";
import { useRestaurant } from "./RestaurantProvider";
import {
  TenantContext,
  type TenantContextValue,
} from "./tenant-context";

export type { TenantContextValue };

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const { restaurantId, restaurant, refresh: refreshRestaurants } =
    useRestaurant();
  const [member, setMember] = useState<TenantContextValue["member"]>(null);
  const [members, setMembers] = useState<TenantContextValue["members"]>([]);
  const [branches, setBranches] = useState<TenantContextValue["branches"]>([]);
  const [billing, setBilling] = useState<TenantContextValue["billing"]>(null);
  const [invoices, setInvoices] = useState<TenantContextValue["invoices"]>([]);
  const [ready, setReady] = useState(false);

  // Una sola pasada por uid (evitar spam de permisos + parpadeo)
  const inviteTriedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      inviteTriedUid.current = null;
      return;
    }
    if (inviteTriedUid.current === user.uid) return;
    inviteTriedUid.current = user.uid;
    void acceptPendingInvites(user)
      .then(async (n) => {
        if (n <= 0) return;
        await reloadCurrentUser();
        await refreshRestaurants({ silent: true });
      })
      .catch((e) => {
        console.warn("[TenantProvider] acceptPendingInvites:", e);
      });
  }, [user, refreshRestaurants]);

  useEffect(() => {
    if (!user || !restaurantId) {
      setMember(null);
      setMembers([]);
      setBranches([]);
      setBilling(null);
      setInvoices([]);
      setReady(true);
      return;
    }

    setReady(false);
    let billingUnsub: (() => void) | null = null;
    let invoicesUnsub: (() => void) | null = null;

    const stopBilling = () => {
      billingUnsub?.();
      invoicesUnsub?.();
      billingUnsub = null;
      invoicesUnsub = null;
    };

    const unsubMember = subscribeMember(restaurantId, user.uid, (m) => {
      setMember(m);
      setReady(true);
      const roleId = m?.roleId ?? m?.role;
      const manages =
        Boolean(user.isSuperAdmin) ||
        (Boolean(m?.active) &&
          roleId != null &&
          ["propietario", "gerente", "super_admin"].includes(roleId));
      stopBilling();
      if (manages) {
        void ensureTenantBilling({
          restaurantId,
          billingEmail: restaurant?.email || user.email,
        }).catch(() => undefined);
        billingUnsub = subscribeBilling(restaurantId, setBilling);
        invoicesUnsub = subscribeInvoices(restaurantId, setInvoices);
      } else {
        setBilling(null);
        setInvoices([]);
      }
    });
    const unsubMembers = subscribeMembers(
      restaurantId,
      setMembers,
      () => setMembers([]),
    );
    const unsubBranches = subscribeBranches(restaurantId, setBranches);

    return () => {
      stopBilling();
      unsubMember();
      unsubMembers();
      unsubBranches();
    };
  }, [user, restaurantId, restaurant?.email]);

  const role = member?.roleId ?? member?.role ?? null;
  const permissions = useMemo(() => {
    if (user?.isSuperAdmin) {
      return resolveEffectivePermissions({ roleId: "super_admin" });
    }
    if (!member || !member.active || !role) return [];
    // Cache desactualizado (p. ej. mesero sin payments.charge) → recalcular
    const cacheFresh =
      member.permissionsCached?.length &&
      member.permissionsVersion === PERMISSION_CATALOG_VERSION;
    if (cacheFresh) {
      return member.permissionsCached;
    }
    return resolveEffectivePermissions({
      roleId: role,
      permissionAllow: member.permissionAllow,
      permissionDeny: member.permissionDeny,
    });
  }, [user?.isSuperAdmin, member, role]);

  const permSet = useMemo(() => new Set(permissions), [permissions]);

  const refreshInvites = useCallback(async () => {
    if (!user) return 0;
    inviteTriedUid.current = null; // permitir reintento manual
    const n = await acceptPendingInvites(user);
    inviteTriedUid.current = user.uid;
    if (n > 0) {
      await reloadCurrentUser();
      await refreshRestaurants({ silent: true });
    }
    return n;
  }, [user, refreshRestaurants]);

  const value = useMemo<TenantContextValue>(
    () => ({
      ready,
      member,
      members,
      branches,
      billing,
      invoices,
      role,
      permissions,
      branchIds: member?.branchIds ?? [],
      can: (permission) =>
        Boolean(user?.isSuperAdmin) || canPermission(permSet, permission),
      hasRole: (allowed) => hasRole(role ?? undefined, allowed),
      hasAnyRole: (allowed) => hasAnyRole(role ?? undefined, allowed),
      isStaff: isStaff(role ?? undefined),
      canManage: canManageRestaurant(role ?? undefined),
      canAccessBranch: (branchId) => {
        if (user?.isSuperAdmin) return true;
        const ids = member?.branchIds ?? [];
        return ids.length === 0 || ids.includes(branchId);
      },
      refreshInvites,
    }),
    [
      ready,
      member,
      members,
      branches,
      billing,
      invoices,
      role,
      permissions,
      permSet,
      user?.isSuperAdmin,
      refreshInvites,
    ],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function useTenantOptional(): TenantContextValue | null {
  return useContext(TenantContext);
}
