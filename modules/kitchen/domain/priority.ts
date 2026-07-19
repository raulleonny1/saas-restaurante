import type { KitchenColumnId, KitchenPriority } from "@/types/kitchen";
import type { OrderItem, OrderStatus } from "@/types/orders";

export function itemToColumn(status: OrderStatus): KitchenColumnId | null {
  switch (status) {
    case "sent":
    case "open":
      return "queued";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "delivered":
      return "delivered";
    default:
      return null;
  }
}

export function columnToStatus(column: KitchenColumnId): OrderStatus {
  switch (column) {
    case "queued":
      return "sent";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "delivered":
      return "delivered";
  }
}

/** Elapsed from the moment the line became relevant for the kitchen. */
export function itemElapsedMs(item: OrderItem, now = Date.now()): number {
  const start =
    item.startedAt ||
    item.sentAt ||
    item.readyAt ||
    item.deliveredAt;
  if (!start) return 0;
  return Math.max(0, now - new Date(start).getTime());
}

/**
 * Priority by time vs target prep.
 * normal < 70% target · warning < 100% · urgent < 140% · critical beyond
 */
export function calcPriority(
  elapsedMs: number,
  targetPrepMs: number,
): KitchenPriority {
  const t = Math.max(targetPrepMs, 60_000);
  const ratio = elapsedMs / t;
  if (ratio >= 1.4) return "critical";
  if (ratio >= 1.0) return "urgent";
  if (ratio >= 0.7) return "warning";
  return "normal";
}

export function maxPriority(
  a: KitchenPriority,
  b: KitchenPriority,
): KitchenPriority {
  const rank: Record<KitchenPriority, number> = {
    normal: 0,
    warning: 1,
    urgent: 2,
    critical: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const PRIORITY_STYLES: Record<
  KitchenPriority,
  { bar: string; card: string; label: string }
> = {
  normal: {
    bar: "bg-success",
    card: "border-border bg-bg-elevated",
    label: "A tiempo",
  },
  warning: {
    bar: "bg-warning",
    card: "border-warning/50 bg-[var(--warning-soft)]",
    label: "Atención",
  },
  urgent: {
    bar: "bg-danger",
    card: "border-danger/45 bg-[var(--danger-soft)]",
    label: "Urgente",
  },
  critical: {
    bar: "bg-danger animate-pulse",
    card: "border-danger bg-[var(--danger-soft)] shadow-[0_0_0_2px_color-mix(in_oklab,var(--danger)_35%,transparent)]",
    label: "Crítico",
  },
};
