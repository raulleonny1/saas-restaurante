import type { ISODateString, Timestamps } from "./common";

/**
 * Cross-domain history stream (historial operativo del restaurante).
 * Prefer specific histories (orderEvents, customerHistory) when possible;
 * use this for aggregated timelines / search.
 */
export type HistoryEntityType =
  | "order"
  | "payment"
  | "reservation"
  | "inventory"
  | "employee"
  | "customer"
  | "promotion"
  | "product"
  | "branch"
  | "ai";

export interface HistoryEvent extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string | null;
  entityType: HistoryEntityType;
  entityId: string;
  action: string;
  summary: string;
  actorUid: string | null;
  actorRole?: string;
  metadata?: Record<string, unknown>;
  occurredAt: ISODateString;
}
