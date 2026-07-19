import { SYSTEM_ROLES } from "@/lib/rbac/defaults";
import type { RoleId } from "@/types/rbac";

export const ROLE_LABELS: Record<RoleId, string> = Object.fromEntries(
  SYSTEM_ROLES.map((r) => [r.id, r.name]),
) as Record<RoleId, string>;

export const ROLE_DESCRIPTIONS: Record<RoleId, string> = Object.fromEntries(
  SYSTEM_ROLES.map((r) => [r.id, r.description]),
) as Record<RoleId, string>;

export const ROLE_RANK: Record<RoleId, number> = Object.fromEntries(
  SYSTEM_ROLES.map((r) => [r.id, r.rank]),
) as Record<RoleId, number>;

/** Roles that own/create a restaurant on sign-up. */
export const ROLES_WITH_VENUE: RoleId[] = SYSTEM_ROLES.filter((r) => r.createsVenue).map(
  (r) => r.id,
);

/** Only these roles may create a venue via /onboarding. Invited staff never. */
export function canCreateVenue(role: RoleId | string | null | undefined): boolean {
  return !!role && ROLES_WITH_VENUE.includes(role as RoleId);
}

/** Staff roles (non-customer, non-platform). */
export const STAFF_ROLES: RoleId[] = SYSTEM_ROLES.filter(
  (r) => r.scope === "tenant" && r.id !== "cliente",
).map((r) => r.id);

export function isUserRole(value: unknown): value is RoleId {
  return typeof value === "string" && value in ROLE_LABELS;
}

export function hasRole(
  userRole: RoleId | undefined,
  allowed: RoleId | RoleId[],
): boolean {
  if (!userRole) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(userRole);
}

export function hasAnyRole(
  userRole: RoleId | undefined,
  allowed: RoleId[],
): boolean {
  return hasRole(userRole, allowed);
}

export function isStaff(role: RoleId | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function canManageRestaurant(role: RoleId | undefined): boolean {
  return hasRole(role, ["propietario", "gerente", "super_admin"]);
}

/**
 * Personal de sala: solo app /waiter (no dashboard admin del dueño).
 * Cajero también opera desde sala (cobro en mesas).
 */
export const WAITER_ONLY_ROLES: RoleId[] = ["mesero", "cajero"];

export function isWaiterOnlyRole(role: RoleId | null | undefined): boolean {
  return !!role && WAITER_ONLY_ROLES.includes(role);
}

/** Dueño / gerente / supervisor: gestionan sala (mesas + meseros + asignación). */
export function isSalaAdminRole(role: RoleId | null | undefined): boolean {
  return hasRole(role ?? undefined, [
    "propietario",
    "gerente",
    "supervisor",
    "super_admin",
  ]);
}

/** Destino post-login / home según rol. */
export function homePathForRole(role: RoleId | string | null | undefined): string {
  if (role === "cliente") return "/";
  if (isWaiterOnlyRole(role as RoleId)) return "/waiter";
  if (role === "cocinero" || role === "barista") return "/kitchen";
  // Administrador de sala (gerente/supervisor) → su panel, no el KPI del dueño
  if (role === "gerente" || role === "supervisor") return "/admin";
  return "/dashboard";
}

/**
 * Pick the role to show/enforce when profile and membership disagree
 * (e.g. signup race left members/{uid}.roleId = "cliente").
 */
export function resolveDisplayRole(
  profileRole: RoleId | null | undefined,
  memberRole: RoleId | null | undefined,
): RoleId | null {
  if (!profileRole && !memberRole) return null;
  if (!memberRole) return profileRole ?? null;
  if (!profileRole) return memberRole;
  // Raced membership must not hide a staff/owner profile
  if (memberRole === "cliente" && profileRole !== "cliente") {
    return profileRole;
  }
  const p = ROLE_RANK[profileRole] ?? 0;
  const m = ROLE_RANK[memberRole] ?? 0;
  return p >= m ? profileRole : memberRole;
}
