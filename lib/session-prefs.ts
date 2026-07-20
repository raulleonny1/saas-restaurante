/**
 * Preferencias de sesión aisladas por usuario (+ restaurante).
 * Evita que en un mismo dispositivo un cajero/mesero herede la sucursal de otro.
 */

export type BranchPrefScope =
  | "pos"
  | "kitchen"
  | "inventory"
  | "reservations"
  | "delivery";

const LEGACY_BRANCH_KEYS: Record<BranchPrefScope, string> = {
  pos: "smartserve_pos_branch",
  kitchen: "smartserve_kitchen_branch",
  inventory: "smartserve_inventory_branch",
  reservations: "smartserve_reservations_branch",
  delivery: "smartserve_delivery_branch",
};

export function branchPrefKey(
  scope: BranchPrefScope,
  uid: string,
  restaurantId: string,
): string {
  return `smartserve_${scope}_branch:${uid}:${restaurantId}`;
}

export function getBranchPref(
  scope: BranchPrefScope,
  uid: string | null | undefined,
  restaurantId: string | null | undefined,
): string | null {
  if (typeof window === "undefined" || !uid || !restaurantId) return null;
  const scoped = localStorage.getItem(branchPrefKey(scope, uid, restaurantId));
  if (scoped) return scoped;
  // Migración puntual de clave global antigua (solo si existe)
  return localStorage.getItem(LEGACY_BRANCH_KEYS[scope]);
}

export function setBranchPref(
  scope: BranchPrefScope,
  uid: string | null | undefined,
  restaurantId: string | null | undefined,
  branchId: string,
): void {
  if (typeof window === "undefined" || !uid || !restaurantId) return;
  localStorage.setItem(branchPrefKey(scope, uid, restaurantId), branchId);
  // Dejar de usar la clave global
  localStorage.removeItem(LEGACY_BRANCH_KEYS[scope]);
}

export function restaurantPrefKey(uid: string): string {
  return `smartserve_active_restaurant:${uid}`;
}

export function getRestaurantPref(uid: string | null | undefined): string | null {
  if (typeof window === "undefined" || !uid) return null;
  const scoped = localStorage.getItem(restaurantPrefKey(uid));
  if (scoped) return scoped;
  return localStorage.getItem("smartserve_active_restaurant");
}

export function setRestaurantPref(
  uid: string | null | undefined,
  restaurantId: string | null,
): void {
  if (typeof window === "undefined" || !uid) return;
  if (restaurantId) {
    localStorage.setItem(restaurantPrefKey(uid), restaurantId);
  } else {
    localStorage.removeItem(restaurantPrefKey(uid));
  }
  localStorage.removeItem("smartserve_active_restaurant");
}

/** Elige sucursal permitida sin heredar una ajena. */
export function pickAllowedBranchId(input: {
  allowedIds: string[];
  current: string | null;
  stored: string | null;
  defaultBranchId?: string | null;
  isDefaultId?: string | null;
}): string | null {
  const allowed = new Set(input.allowedIds);
  if (input.current && allowed.has(input.current)) return input.current;
  if (input.stored && allowed.has(input.stored)) return input.stored;
  if (input.defaultBranchId && allowed.has(input.defaultBranchId)) {
    return input.defaultBranchId;
  }
  if (input.isDefaultId && allowed.has(input.isDefaultId)) {
    return input.isDefaultId;
  }
  return input.allowedIds[0] ?? null;
}

/** Tokens de sesión de dispositivo (no preferencias de sucursal). */
export function clearDeviceSessionArtifacts(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("smartserve_gcal_access_token");
  } catch {
    /* ignore */
  }
}
