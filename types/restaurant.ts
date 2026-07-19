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

/** Ancho de rollo térmico habitual (mm). */
export type ThermalPaperWidth = 58 | 80;

/** Impresora asignada a un uso (TPV cliente o cocina). */
export interface PrinterStationConfig {
  /** Nombre exacto como aparece en Windows / macOS (ayuda al elegir en el diálogo). */
  systemName?: string;
  /** Etiqueta amigable en la app (ej. «Cocina planta baja»). */
  label?: string;
  paperWidthMm?: ThermalPaperWidth;
  /**
   * Abrir cajón portamonedas tradicional al cobrar en efectivo.
   * El cajón va cableado (RJ11/RJ12) a la impresora térmica de ventas;
   * el asistente local envía el pulso ESC/POS.
   */
  openDrawerOnCash?: boolean;
  /** Pin del cajón: 0 = pin 2 (habitual), 1 = pin 5. */
  drawerPin?: 0 | 1;
}

/**
 * Dos destinos de impresión: ticket de cliente (TPV) y comanda de cocina.
 * El navegador no puede instalar drivers solos: la impresora debe existir
 * en el sistema (USB o red). Aquí se guardan nombre y formato de cada una.
 */
export interface RestaurantPrintersSettings {
  tpv?: PrinterStationConfig;
  kitchen?: PrinterStationConfig;
}

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
  /** Impresora TPV (ticket cliente) e impresora de cocina. */
  printers?: RestaurantPrintersSettings;
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
  printers: {
    tpv: { label: "TPV · ticket cliente", paperWidthMm: 80 },
    kitchen: { label: "Cocina · comanda", paperWidthMm: 80 },
  },
};
