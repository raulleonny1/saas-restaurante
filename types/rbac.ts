/**
 * RBAC contracts — SmartServe AI
 * Permission IDs are stable forever; never rename, only deprecate.
 */

export type RoleId =
  | "super_admin"
  | "propietario"
  | "gerente"
  | "supervisor"
  | "cajero"
  | "mesero"
  | "cocinero"
  | "barista"
  | "repartidor"
  | "cliente";

export type PermissionScope = "platform" | "tenant" | "branch";

export type PermissionModule =
  | "platform"
  | "restaurant"
  | "billing"
  | "settings"
  | "branches"
  | "members"
  | "roles"
  | "employees"
  | "catalog"
  | "inventory"
  | "tables"
  | "pos"
  | "orders"
  | "payments"
  | "invoices"
  | "kitchen"
  | "bar"
  | "delivery"
  | "customers"
  | "loyalty"
  | "reservations"
  | "marketing"
  | "reports"
  | "history"
  | "audit"
  | "ai"
  | "notifications"
  | "website";

/** Every permission the platform knows about. */
export type PermissionId =
  // platform
  | "platform.tenants.read"
  | "platform.tenants.manage"
  | "platform.billing.manage"
  | "platform.users.impersonate"
  | "platform.feature_flags.manage"
  | "platform.audit.read_all"
  // restaurant / billing / settings
  | "restaurant.read"
  | "restaurant.update"
  | "billing.read"
  | "billing.manage"
  | "settings.read"
  | "settings.manage"
  // branches
  | "branches.read"
  | "branches.create"
  | "branches.update"
  | "branches.delete"
  // members / roles
  | "members.read"
  | "members.invite"
  | "members.update"
  | "members.remove"
  | "roles.read"
  | "roles.manage"
  | "roles.assign"
  // employees
  | "employees.read"
  | "employees.manage"
  | "employees.shifts.manage"
  // catalog
  | "catalog.read"
  | "catalog.products.manage"
  | "catalog.categories.manage"
  | "catalog.ingredients.manage"
  // inventory
  | "inventory.read"
  | "inventory.adjust"
  | "inventory.purchases.manage"
  | "inventory.waste.manage"
  | "inventory.suppliers.manage"
  // tables / pos / orders / payments / invoices
  | "tables.read"
  | "tables.manage"
  | "pos.access"
  | "pos.discount"
  | "pos.tip"
  | "pos.split"
  | "pos.move_merge"
  | "orders.read"
  | "orders.create"
  | "orders.update"
  | "orders.cancel"
  | "orders.refund"
  | "payments.charge"
  | "payments.refund"
  | "payments.cash_drawer"
  | "invoices.read"
  | "invoices.issue"
  | "invoices.void"
  // kitchen / bar / delivery
  | "kitchen.access"
  | "kitchen.update_status"
  | "bar.access"
  | "bar.update_status"
  | "delivery.access"
  | "delivery.update_status"
  | "delivery.assign"
  // crm
  | "customers.read"
  | "customers.manage"
  | "loyalty.read"
  | "loyalty.adjust"
  // reservations
  | "reservations.read"
  | "reservations.manage"
  | "reservations.manage_own"
  // marketing
  | "marketing.read"
  | "marketing.campaigns.manage"
  | "marketing.coupons.manage"
  // insights
  | "reports.read"
  | "history.read"
  | "audit.read"
  // ai
  | "ai.assistant"
  | "ai.insights"
  | "ai.manage"
  // notifications
  | "notifications.read"
  | "notifications.manage"
  // website
  | "website.read"
  | "website.manage";

export type RolePermissionMap = Record<PermissionId, boolean>;

export interface PermissionDefinition {
  id: PermissionId;
  module: PermissionModule;
  action: string;
  label: string;
  description: string;
  group: string;
  scope: PermissionScope;
  dangerous?: boolean;
}

export interface SystemRoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  rank: number;
  scope: "platform" | "tenant";
  assignableOnSignup: boolean;
  createsVenue: boolean;
}

/** Overlay stored in restaurants/{id}/roles/{roleId} */
export interface TenantRoleOverlay {
  id: RoleId | string;
  restaurantId: string;
  name?: string;
  baseRoleId: RoleId;
  /** Sparse toggles — only store diffs from system defaults when possible. */
  permissions: Partial<RolePermissionMap>;
  isSystem: boolean;
  updatedAt: string;
  updatedBy: string;
}

/** AuthZ fields on members/{uid} */
export interface MemberRbacFields {
  roleId: RoleId;
  branchIds: string[];
  permissionAllow: PermissionId[];
  permissionDeny: PermissionId[];
  /** Materialized effective set for fast checks / rules. */
  permissionsCached: PermissionId[];
  permissionsVersion: string;
}

export const PERMISSION_CATALOG_VERSION = "1.0.0";
