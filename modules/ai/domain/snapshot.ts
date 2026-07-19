import type { Ingredient, Product } from "@/types/catalog";
import type { Customer } from "@/types/customers";
import type { Employee } from "@/types/employees";
import type { InventoryLevel, WasteEntry } from "@/types/inventory";
import type { Order } from "@/types/orders";
import type { Coupon, Promotion } from "@/types/promotions";

/** Read-only business context for the AI manager (no vendor SDKs). */
export interface BusinessSnapshot {
  restaurantId: string;
  restaurantName: string;
  currency: string;
  generatedAt: string;
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  levels: InventoryLevel[];
  waste: WasteEntry[];
  customers: Customer[];
  employees: Employee[];
  promotions: Promotion[];
  coupons: Coupon[];
}

export interface AnalysisFinding {
  intent: string;
  title: string;
  confidence: number;
  bullets: string[];
  metrics?: Record<string, number | string>;
  actions?: string[];
  refs?: Array<{ type: string; id: string; label?: string }>;
}

export function paidInWindow(
  orders: Order[],
  fromMs: number,
  toMs: number,
): Order[] {
  return orders.filter((o) => {
    if (o.deletedAt || o.status !== "paid") return false;
    const t = new Date(o.paidAt ?? o.updatedAt).getTime();
    return t >= fromMs && t <= toMs;
  });
}

export function daysAgo(n: number, now = Date.now()): number {
  return now - n * 86_400_000;
}

export function money(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(n);
}
