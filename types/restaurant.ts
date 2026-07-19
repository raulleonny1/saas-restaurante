import type {
  CurrencyCode,
  EntityStatus,
  ISODateString,
  SoftDelete,
  Timezone,
  Timestamps,
} from "./common";
import type { PermissionId, RoleId } from "./rbac";

export type MemberRole = RoleId;

/** Salida de comandas de cocina: pantalla KDS, impresora térmica, o ambas. */
export type KitchenOutputMode = "kds" | "printer" | "both";

export interface RestaurantSettings {
  tipDefaultPercent: number;
  taxPercent: number;
  stripeEnabled: boolean;
  sumupEnabled: boolean;
  locale: string;
  defaultBranchId?: string;
  /**
   * Cómo salen las comandas al «Enviar a cocina».
   * - kds: solo pantalla /kitchen|/bar (default)
   * - printer: ticket térmico (impresora del sistema / red con driver)
   * - both: imprime y sigue el KDS
   */
  kitchenOutput?: KitchenOutputMode;
}

/** Brand / company (multi-sucursal parent). */
export interface Restaurant extends Timestamps, SoftDelete {
  id: string;
  name: string;
  legalName?: string;
  timezone: Timezone;
  currency: CurrencyCode;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  status: EntityStatus;
  settings: RestaurantSettings;
  /** Public site path: /r/{slug} */
  slug?: string;
  /** Mirrors websiteSettings.published for fast public reads. */
  websitePublished?: boolean;
}

/** Physical location under a restaurant. */
export interface Branch extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  timezone: Timezone;
  currency: CurrencyCode;
  status: EntityStatus;
  isDefault: boolean;
  openingHours?: Record<string, { open: string; close: string } | null>;
}

/** Auth membership link: user ↔ restaurant (+ optional branch access). */
export interface Member extends Timestamps {
  uid: string;
  restaurantId: string;
  email: string;
  displayName: string;
  /** @deprecated prefer roleId */
  role: MemberRole;
  roleId: RoleId;
  /** Empty = all branches; otherwise restricted. */
  branchIds: string[];
  permissionAllow: PermissionId[];
  permissionDeny: PermissionId[];
  permissionsCached: PermissionId[];
  permissionsVersion: string;
  active: boolean;
  joinedAt: ISODateString;
}

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  tipDefaultPercent: 10,
  taxPercent: 10,
  stripeEnabled: false,
  sumupEnabled: false,
  locale: "es-ES",
  kitchenOutput: "kds",
};
