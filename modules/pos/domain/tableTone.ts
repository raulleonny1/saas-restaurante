import type { Order, Table } from "@/types/orders";

/**
 * Colores de mesa en plano (waiter + POS admin):
 * - free: libre
 * - occupied (rojo): mesa ocupada sin líneas, o sin pedido aún
 * - ordering (amarillo): hay ítems sin enviar a cocina
 * - sent (verde): pedido enviado / en cocina
 * - ready (cian): hay platos listos para retirar
 * - reserved / dirty: estados especiales
 */
export type TableFloorTone =
  | "free"
  | "occupied"
  | "ordering"
  | "sent"
  | "ready"
  | "reserved"
  | "dirty";

export function orderForTable(
  table: Table,
  openOrders: Order[],
): Order | null {
  return (
    openOrders.find((o) => o.id === table.currentOrderId) ??
    openOrders.find((o) => o.tableId === table.id) ??
    null
  );
}

function itemPendingSend(item: Order["items"][number]): boolean {
  if (item.status === "cancelled") return false;
  if (item.status === "open") return true;
  if (!item.sentAt) return true;
  return false;
}

export function resolveTableFloorTone(
  table: Table,
  order: Order | null,
): TableFloorTone {
  if (table.status === "reserved") return "reserved";
  if (table.status === "dirty") return "dirty";

  const hasService =
    table.status === "occupied" ||
    Boolean(table.currentOrderId) ||
    Boolean(order);

  if (!hasService) return "free";

  if (!order || order.items.length === 0) return "occupied";

  // Pedido ya cobrado / cerrado → no parpadear «Listo»
  // (dirty/reserved ya se resolvieron arriba)
  if (order.status === "paid" || order.status === "cancelled") {
    return "free";
  }

  const pending = order.items.filter(itemPendingSend);
  if (pending.length > 0) return "ordering";

  // Solo parpadea si queda algo por retirar (status ready)
  if (order.items.some((i) => i.status === "ready")) return "ready";

  // Todo servido pero aún no cobrado
  const active = order.items.filter((i) => i.status !== "cancelled");
  if (
    active.length > 0 &&
    active.every((i) => i.status === "delivered")
  ) {
    return "sent";
  }

  return "sent";
}

export const TABLE_TONE_LABEL: Record<TableFloorTone, string> = {
  free: "Libre",
  occupied: "Ocupada",
  ordering: "Pidiendo",
  sent: "En cocina",
  ready: "Listo · retirar",
  reserved: "Reservada",
  dirty: "Sucia",
};

/** Estilos plano admin (POS claro). */
export const TABLE_TONE_ADMIN: Record<TableFloorTone, string> = {
  free: "border-border bg-bg-elevated hover:border-accent/40",
  occupied:
    "border-red-500/70 bg-red-500/15 text-red-950 dark:text-red-50 hover:border-red-500",
  ordering:
    "border-amber-500/70 bg-amber-400/20 text-amber-950 dark:text-amber-50 hover:border-amber-500",
  sent: "border-emerald-500/70 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50 hover:border-emerald-500",
  ready:
    "border-cyan-500/80 bg-cyan-400/25 text-cyan-950 dark:text-cyan-50 hover:border-cyan-400",
  reserved: "border-sky-500/50 bg-sky-500/10",
  dirty: "border-stone-400/50 bg-stone-400/15",
};

/** Estilos plano mesero (fondo oscuro). */
export const TABLE_TONE_WAITER: Record<TableFloorTone, string> = {
  free: "border-white/15 bg-white/5",
  occupied: "border-red-500/60 bg-red-950/55",
  ordering: "border-amber-400/60 bg-amber-950/45",
  sent: "border-emerald-500/60 bg-emerald-950/50",
  ready: "border-cyan-400/80 bg-cyan-950/60 animate-pulse",
  reserved: "border-sky-500/40 bg-sky-950/30",
  dirty: "border-stone-400/40 bg-stone-900/50",
};
