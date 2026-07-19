import type {
  PermissionId,
  RoleId,
  RolePermissionMap,
  TenantRoleOverlay,
} from "@/types/rbac";
import { PERMISSION_CATALOG_VERSION } from "@/types/rbac";
import { PERMISSION_IDS, PLATFORM_PERMISSION_IDS } from "./catalog";
import { SYSTEM_ROLE_DEFAULTS } from "./defaults";

export interface ResolveInput {
  roleId: RoleId;
  tenantOverlay?: Pick<TenantRoleOverlay, "permissions"> | null;
  permissionAllow?: PermissionId[];
  permissionDeny?: PermissionId[];
}

/**
 * Resolves the effective permission set.
 * Order: system defaults → tenant toggles → member allow → member deny (deny wins).
 */
export function resolveEffectivePermissions(input: ResolveInput): PermissionId[] {
  const base: RolePermissionMap = { ...SYSTEM_ROLE_DEFAULTS[input.roleId] };

  if (input.tenantOverlay?.permissions) {
    for (const [key, enabled] of Object.entries(input.tenantOverlay.permissions)) {
      if (enabled === undefined) continue;
      if ((PERMISSION_IDS as string[]).includes(key)) {
        base[key as PermissionId] = enabled;
      }
    }
  }

  const enabled = new Set<PermissionId>();
  for (const id of PERMISSION_IDS) {
    if (base[id]) enabled.add(id);
  }

  for (const id of input.permissionAllow ?? []) enabled.add(id);
  for (const id of input.permissionDeny ?? []) enabled.delete(id);

  if (input.roleId !== "super_admin") {
    for (const id of PLATFORM_PERMISSION_IDS) enabled.delete(id);
  }

  return PERMISSION_IDS.filter((id) => enabled.has(id));
}

export function can(
  effective: Iterable<PermissionId>,
  permission: PermissionId,
): boolean {
  if (effective instanceof Set) return effective.has(permission);
  return new Set(effective).has(permission);
}

export function canAny(
  effective: Iterable<PermissionId>,
  permissions: PermissionId[],
): boolean {
  const set = effective instanceof Set ? effective : new Set(effective);
  return permissions.some((p) => set.has(p));
}

export function canAll(
  effective: Iterable<PermissionId>,
  permissions: PermissionId[],
): boolean {
  const set = effective instanceof Set ? effective : new Set(effective);
  return permissions.every((p) => set.has(p));
}

/** Can actor assign targetRole? Must have roles.assign and higher rank. */
export function canAssignRole(
  actorRoleId: RoleId,
  targetRoleId: RoleId,
  actorRank: number,
  targetRank: number,
  actorPermissions: Iterable<PermissionId>,
): boolean {
  if (targetRoleId === "super_admin") return actorRoleId === "super_admin";
  if (!can(actorPermissions, "roles.assign")) return false;
  return actorRank > targetRank;
}

export function buildMemberPermissionCache(input: ResolveInput): {
  permissionsCached: PermissionId[];
  permissionsVersion: string;
} {
  return {
    permissionsCached: resolveEffectivePermissions(input),
    permissionsVersion: PERMISSION_CATALOG_VERSION,
  };
}

/** Toggle a single permission in a sparse overlay (tenant role editor). */
export function toggleOverlayPermission(
  overlay: Partial<RolePermissionMap>,
  permission: PermissionId,
  enabled: boolean,
  baseRoleId: RoleId,
): Partial<RolePermissionMap> {
  const systemDefault = SYSTEM_ROLE_DEFAULTS[baseRoleId][permission];
  const next = { ...overlay };
  if (enabled === systemDefault) {
    delete next[permission];
  } else {
    next[permission] = enabled;
  }
  return next;
}
