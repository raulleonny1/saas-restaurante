"use client";

import { getDb } from "@/lib/firebase";
import type { BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { nowIso } from "@/modules/ai/domain/ids";
import type { Ingredient, Product } from "@/types/catalog";
import type { Customer } from "@/types/customers";
import type { Employee } from "@/types/employees";
import type { InventoryLevel, WasteEntry } from "@/types/inventory";
import type { Order } from "@/types/orders";
import type { Coupon, Promotion } from "@/types/promotions";
import { collection, getDocs } from "firebase/firestore";

async function load<T extends { id: string }>(
  restaurantId: string,
  name: string,
): Promise<T[]> {
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, name),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** One-shot read of operational collections for the AI manager. */
export async function loadBusinessSnapshot(input: {
  restaurantId: string;
  restaurantName: string;
  currency: string;
}): Promise<BusinessSnapshot> {
  const [
    orders,
    products,
    ingredients,
    levels,
    waste,
    customers,
    employees,
    promotions,
    coupons,
  ] = await Promise.all([
    load<Order>(input.restaurantId, "orders"),
    load<Product>(input.restaurantId, "products"),
    load<Ingredient>(input.restaurantId, "ingredients"),
    load<InventoryLevel>(input.restaurantId, "inventoryLevels"),
    load<WasteEntry>(input.restaurantId, "waste"),
    load<Customer>(input.restaurantId, "customers"),
    load<Employee>(input.restaurantId, "employees"),
    load<Promotion>(input.restaurantId, "promotions"),
    load<Coupon>(input.restaurantId, "coupons"),
  ]);

  return {
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    currency: input.currency,
    generatedAt: nowIso(),
    orders: orders.filter((o) => !o.deletedAt),
    products: products.filter((p) => !p.deletedAt),
    ingredients: ingredients.filter((i) => !i.deletedAt),
    levels,
    waste,
    customers: customers.filter((c) => !c.deletedAt),
    employees: employees.filter((e) => !e.deletedAt),
    promotions: promotions.filter((p) => !p.deletedAt),
    coupons: coupons.filter((c) => !c.deletedAt),
  };
}
