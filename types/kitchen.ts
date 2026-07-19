import type { Order, OrderItem, OrderStatus } from "./orders";

export type KitchenStationId = "bar" | "cocina" | "postres" | "bebidas";

export type KitchenColumnId = "queued" | "preparing" | "ready" | "delivered";

export type KitchenPriority = "normal" | "warning" | "urgent" | "critical";

export interface KitchenStationDef {
  id: KitchenStationId;
  label: string;
}

export const KITCHEN_STATIONS: KitchenStationDef[] = [
  { id: "bar", label: "Bar" },
  { id: "cocina", label: "Cocina" },
  { id: "postres", label: "Postres" },
  { id: "bebidas", label: "Bebidas" },
];

/** Item statuses visible on the KDS. */
export const KITCHEN_ITEM_STATUSES: OrderStatus[] = [
  "sent",
  "preparing",
  "ready",
  "delivered",
];

export interface KitchenTicketItem {
  item: OrderItem;
  station: KitchenStationId;
  column: KitchenColumnId;
  priority: KitchenPriority;
  elapsedMs: number;
  targetPrepMs: number;
}

export interface KitchenTicket {
  order: Order;
  station: KitchenStationId;
  items: KitchenTicketItem[];
  /** Oldest relevant timestamp for sort / sound. */
  bumpedAt: string;
  priority: KitchenPriority;
  elapsedMs: number;
}
