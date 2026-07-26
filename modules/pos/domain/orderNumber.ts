import type { Order } from "@/types/orders";

/** Número visible de orden (001, 042…). */
export function formatOrderNumber(
  orderNumber: number | null | undefined,
): string {
  if (orderNumber == null || !Number.isFinite(orderNumber) || orderNumber < 1) {
    return "—";
  }
  return String(Math.trunc(orderNumber)).padStart(3, "0");
}

/** Etiqueta corta: #042 */
export function orderNumberTag(
  order: Pick<Order, "orderNumber" | "id"> | null | undefined,
): string {
  if (!order) return "—";
  if (order.orderNumber != null && order.orderNumber >= 1) {
    return `#${formatOrderNumber(order.orderNumber)}`;
  }
  return `#${order.id.slice(0, 6)}`;
}

/** Cabecera: Orden #042 · Mesa 5 */
export function orderHeading(
  order: Pick<Order, "orderNumber" | "id" | "tableName"> | null | undefined,
): string {
  if (!order) return "Sin pedido";
  const num = orderNumberTag(order);
  const mesa = order.tableName?.trim();
  return mesa ? `Orden ${num} · Mesa ${mesa}` : `Orden ${num}`;
}
