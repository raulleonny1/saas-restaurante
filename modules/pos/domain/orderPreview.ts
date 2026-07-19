import type { Order, OrderItem } from "@/types/orders";

export function activeOrderItems(order: Order | null | undefined): OrderItem[] {
  if (!order?.items?.length) return [];
  return order.items.filter((i) => i.status !== "cancelled");
}

/** Resumen corto para la tarjeta (máx. `limit` líneas). */
export function orderPreviewLines(
  order: Order | null | undefined,
  limit = 3,
): string[] {
  const items = activeOrderItems(order);
  if (!items.length) return [];
  // Prioriza listos para retirar
  const ranked = [...items].sort((a, b) => {
    const rank = (s: string) =>
      s === "ready" ? 0 : s === "delivered" ? 2 : 1;
    return rank(a.status) - rank(b.status);
  });
  const lines = ranked.slice(0, limit).map((i) => {
    const prefix =
      i.status === "ready"
        ? "Listo · "
        : i.status === "delivered"
          ? "Servido · "
          : "";
    return `${prefix}${i.quantity}× ${i.name}`;
  });
  const rest = ranked.length - limit;
  if (rest > 0) lines.push(`+${rest} más`);
  return lines;
}

export function formatElapsedShort(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
