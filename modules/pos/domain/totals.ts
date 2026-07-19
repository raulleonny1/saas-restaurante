import type { Order, OrderItem } from "@/types/orders";

export function lineTotal(item: OrderItem): number {
  const mods =
    item.modifiers?.reduce((sum, m) => sum + m.priceDelta, 0) ?? 0;
  return (item.unitPrice + mods) * item.quantity;
}

export function calcSubtotal(items: OrderItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
}

export function recalculateOrder(
  order: Pick<
    Order,
    | "items"
    | "discountPercent"
    | "discountAmount"
    | "tipPercent"
    | "tipAmount"
    | "taxAmount"
  >,
  taxPercent: number,
): Pick<
  Order,
  "subtotal" | "discountAmount" | "tipAmount" | "taxAmount" | "total"
> {
  const subtotal = calcSubtotal(order.items);
  const discountFromPct = roundMoney(subtotal * (order.discountPercent / 100));
  const discountAmount = roundMoney(
    Math.max(order.discountAmount, discountFromPct),
  );
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = roundMoney(afterDiscount * (taxPercent / 100));
  const tipFromPct = roundMoney(afterDiscount * (order.tipPercent / 100));
  const tipAmount = roundMoney(Math.max(order.tipAmount, tipFromPct));
  const total = roundMoney(afterDiscount + taxAmount + tipAmount);

  return {
    subtotal,
    discountAmount,
    tipAmount,
    taxAmount,
    total,
  };
}

export function balanceDue(order: Order): number {
  return roundMoney(Math.max(0, order.total - (order.amountPaid ?? 0)));
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
