"use client";

import { getDb } from "@/lib/firebase";
import { levelDocId, newId, nowIso } from "@/modules/inventory/domain/ids";
import type { Ingredient } from "@/types/catalog";
import type { CurrencyCode } from "@/types/common";
import type { InventoryLevel } from "@/types/inventory";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

/** Seeds ingredients + stock levels in Firestore when the restaurant has none. */
export async function ensureInventoryBootstrap(input: {
  restaurantId: string;
  branchId: string;
  currency: CurrencyCode;
}): Promise<{ ingredientsCreated: number }> {
  const { restaurantId, branchId, currency } = input;
  const existing = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "ingredients"),
  );
  if (existing.docs.some((d) => !d.data().deletedAt)) {
    return { ingredientsCreated: 0 };
  }

  const stamp = nowIso();
  const batch = writeBatch(getDb());
  const seeds: Array<{
    name: string;
    unit: Ingredient["unit"];
    cost: number;
    qty: number;
    min: number;
  }> = [
    { name: "Café molido", unit: "kg", cost: 18, qty: 5, min: 1.5 },
    { name: "Leche entera", unit: "L", cost: 1.1, qty: 20, min: 8 },
    { name: "Leche avena", unit: "L", cost: 2.2, qty: 8, min: 3 },
    { name: "Pan burger", unit: "ud", cost: 0.35, qty: 80, min: 24 },
    { name: "Carne burger", unit: "kg", cost: 9.5, qty: 6, min: 2 },
    { name: "Azúcar", unit: "kg", cost: 1.2, qty: 4, min: 1 },
  ];

  let ingredientsCreated = 0;
  for (const s of seeds) {
    const id = newId("ing");
    const clean: Ingredient = {
      id,
      restaurantId,
      name: s.name,
      unit: s.unit,
      costPerUnit: s.cost,
      currency,
      status: "active",
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    batch.set(
      doc(getDb(), "restaurants", restaurantId, "ingredients", id),
      clean,
    );

    const levelId = levelDocId(branchId, id);
    const level: InventoryLevel = {
      id: levelId,
      restaurantId,
      branchId,
      ingredientId: id,
      quantity: s.qty,
      unit: s.unit,
      minStock: s.min,
      createdAt: stamp,
      updatedAt: stamp,
    };
    batch.set(
      doc(getDb(), "restaurants", restaurantId, "inventoryLevels", levelId),
      level,
    );
    ingredientsCreated += 1;
  }

  await batch.commit();
  return { ingredientsCreated };
}
