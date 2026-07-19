import type { ISODateString, Timestamps } from "./common";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "role_change"
  | "payment"
  | "refund"
  | "inventory_adjust"
  | "export"
  | "settings_change"
  | "ai_query";

/**
 * Immutable audit trail for compliance and security.
 * Write-only from clients with elevated role; ideally written via Cloud Functions.
 */
export interface AuditLog extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  actorUid: string;
  actorEmail?: string;
  actorRole?: string;
  /** Before/after snapshots (keep small). */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
  occurredAt: ISODateString;
}
