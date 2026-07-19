import type { OrderItem, OrderStatus } from "@/types/orders";

const LABELS: Partial<Record<OrderStatus, string>> = {
  open: "En mesa",
  sent: "En cocina",
  preparing: "Preparando",
  ready: "Listo · retirar",
  delivered: "Servido",
  cancelled: "Anulado",
};

export function orderItemStatusLabel(status: OrderStatus): string {
  return LABELS[status] ?? status;
}

export function isPickupReady(item: OrderItem): boolean {
  return item.status === "ready";
}

export function isServed(item: OrderItem): boolean {
  return item.status === "delivered";
}
