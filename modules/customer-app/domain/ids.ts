export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  open: "Recibido",
  sent: "Enviado a cocina",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
  paid: "Pagado",
  cancelled: "Cancelado",
};
