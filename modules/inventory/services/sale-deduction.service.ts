"use client";

/**
 * When an order is paid, deduct recipe ingredients from branch stock.
 * Idempotent via fixed movement ids — safe for realtime retries.
 */

import { getDb } from "@/lib/firebase";
import { saleMovementRefId } from "@/modules/inventory/domain/ids";
import { applyStockDelta } from "@/modules/inventory/services/stock.service";
import type { Ingredient, Product } from "@/types/catalog";
import type { IngredientUnit } from "@/types/catalog";
import type { Order } from "@/types/orders";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";

async function loadProduct(
  restaurantId: string,
  productId: string,
): Promise<Product | null> {
  const snap = await getDoc(
    doc(getDb(), "restaurants", restaurantId, "products", productId),
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

async function loadIngredient(
  restaurantId: string,
  ingredientId: string,
): Promise<Ingredient | null> {
  const snap = await getDoc(
    doc(getDb(), "restaurants", restaurantId, "ingredients", ingredientId),
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Ingredient;
}

export async function deductOrderFromInventory(input: {
  restaurantId: string;
  order: Order;
  actorUid: string;
}): Promise<{ applied: number; skipped: number }> {
  const { restaurantId, order, actorUid } = input;
  if (order.status !== "paid" && !order.paidAt) {
    return { applied: 0, skipped: 0 };
  }

  let applied = 0;
  let skipped = 0;

  for (const line of order.items) {
    const product = await loadProduct(restaurantId, line.productId);
    if (!product?.recipe?.length) continue;

    for (const ri of product.recipe) {
      const ingredient = await loadIngredient(restaurantId, ri.ingredientId);
      const unit = (ingredient?.unit ?? ri.unit ?? "ud") as IngredientUnit;
      const delta = -(line.quantity * ri.quantity);
      const movementId = saleMovementRefId(
        order.id,
        line.id,
        ri.ingredientId,
      );

      const result = await applyStockDelta({
        restaurantId,
        branchId: order.branchId,
        ingredientId: ri.ingredientId,
        unit,
        delta,
        type: "sale",
        createdBy: actorUid,
        referenceType: "order",
        referenceId: order.id,
        note: `Venta ${order.tableName ?? order.id.slice(0, 8)} · ${line.name}`,
        movementId,
      });

      if (result.skipped) skipped += 1;
      else applied += 1;
    }
  }

  return { applied, skipped };
}

/**
 * Listens to recently paid orders for a branch and applies recipe deductions.
 */
export function subscribePaidOrdersForDeduction(
  restaurantId: string,
  branchId: string,
  onOrder: (order: Order) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("branchId", "==", branchId),
    where("status", "==", "paid"),
  );
  return onSnapshot(
    q,
    (snap) => {
      for (const d of snap.docs) {
        onOrder({ id: d.id, ...d.data() } as Order);
      }
    },
    (err) => onError?.(err),
  );
}
