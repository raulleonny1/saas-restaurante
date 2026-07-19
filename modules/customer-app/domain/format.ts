import type { OrderStatus } from "@/types/orders";

export function money(n: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    open: "Recibido",
    sent: "Enviado a cocina",
    preparing: "Preparando",
    ready: "Listo",
    delivered: "Entregado",
    paid: "Pagado",
    cancelled: "Cancelado",
  };
  return map[status] ?? status;
}

export function reservationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    seated: "En mesa",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No presentado",
  };
  return map[status] ?? status;
}

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "open",
  "sent",
  "preparing",
  "ready",
];
