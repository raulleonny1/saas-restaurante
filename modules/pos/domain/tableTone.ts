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

function isLiveOpenOrder(order: Order | null | undefined): order is Order {
  return Boolean(
    order && order.status !== "paid" && order.status !== "cancelled",
  );
}

export function orderForTable(
  table: Table,
  openOrders: Order[],
): Order | null {
  // Solo el pedido activo de la mesa (evita tickets huérfanos → «Listo» fantasma)
  if (table.currentOrderId) {
    const linked = openOrders.find((o) => o.id === table.currentOrderId);
    if (isLiveOpenOrder(linked)) return linked;
    // currentOrderId huérfano (pedido ya cobrado/borrado) → sin servicio
  }
  if (table.status === "available" || table.status === "dirty") {
    return null;
  }
  const byTable = openOrders.find(
    (o) =>
      o.tableId === table.id &&
      o.status !== "paid" &&
      o.status !== "cancelled",
  );
  return isLiveOpenOrder(byTable) ? byTable : null;
}

/** Mesa con status ocupada pero sin pedido real (queda «fantasma»). */
export function isStaleOccupiedTable(
  table: Table,
  order: Order | null,
): boolean {
  if (table.status === "dirty" || table.status === "reserved") return false;
  if (isLiveOpenOrder(order)) return false;
  return (
    table.status === "occupied" ||
    Boolean(table.currentOrderId)
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
  // Sucia tras cobrar: hace falta marcar «Ya está limpia»
  if (table.status === "dirty") return "dirty";

  // Sin pedido abierto real → libre (ignora status ocupada huérfana)
  if (!isLiveOpenOrder(order)) return "free";

  // Pedido abierto sin líneas (= abrieron mesa y no pidieron) → sigue libre
  const activeItems = order.items.filter((i) => i.status !== "cancelled");
  if (activeItems.length === 0) return "free";

  const pending = activeItems.filter(itemPendingSend);
  if (pending.length > 0) return "ordering";

  // Solo parpadea si queda algo por retirar (status ready)
  if (activeItems.some((i) => i.status === "ready")) return "ready";

  // Todo servido pero aún no cobrado
  if (activeItems.every((i) => i.status === "delivered")) {
    return "sent";
  }

  return "sent";
}

/** Pedido vivo pero sin ningún ítem (mesa «abierta» en vacío). */
export function isEmptyOpenOrder(order: Order | null): boolean {
  if (!isLiveOpenOrder(order)) return false;
  return !order.items.some((i) => i.status !== "cancelled");
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
  ready: "border-cyan-400/80 bg-cyan-950/60",
  reserved: "border-sky-500/40 bg-sky-950/30",
  dirty: "border-stone-400/40 bg-stone-900/50",
};

/** Solo en la tarjeta de mesa con platos listos (no en la leyenda). */
export const TABLE_TONE_WAITER_LIVE: Partial<Record<TableFloorTone, string>> = {
  ready: "animate-pulse border-cyan-400/80 bg-cyan-950/60",
};

/** Leyenda estática (sin animación). */
export const TABLE_TONE_WAITER_LEGEND: Record<TableFloorTone, string> = {
  free: "border-white/15 bg-white/5",
  occupied: "border-red-500/60 bg-red-950/55",
  ordering: "border-amber-400/60 bg-amber-950/45",
  sent: "border-emerald-500/60 bg-emerald-950/50",
  ready: "border-cyan-400/50 bg-cyan-950/40",
  reserved: "border-sky-500/40 bg-sky-950/30",
  dirty: "border-stone-400/40 bg-stone-900/50",
};
