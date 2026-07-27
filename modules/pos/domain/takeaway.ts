import type { Order } from "@/types/orders";

const TAKEAWAY_NOTE = "PARA LLEVAR";

/** ¿El pedido (o la nota) indica para llevar? */
export function isOrderTakeaway(
  order: Pick<Order, "takeaway" | "notes"> | null | undefined,
): boolean {
  if (!order) return false;
  if (order.takeaway === true) return true;
  return /para\s*llevar/i.test(order.notes ?? "");
}

/** Fusiona/quita la marca en notes al activar o desactivar para llevar. */
export function notesWithTakeawayFlag(
  notes: string | undefined,
  takeaway: boolean,
): string | undefined {
  const cleaned = (notes ?? "")
    .split("·")
    .map((p) => p.trim())
    .filter((p) => p && !/^para\s*llevar$/i.test(p) && p !== TAKEAWAY_NOTE)
    .join(" · ");
  if (!takeaway) return cleaned || undefined;
  return cleaned ? `${TAKEAWAY_NOTE} · ${cleaned}` : TAKEAWAY_NOTE;
}
