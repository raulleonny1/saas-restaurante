"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/inventory/domain/ids";
import { applyStockDelta } from "@/modules/inventory/services/stock.service";
import type { IngredientUnit } from "@/types/catalog";
import type { WasteEntry, WasteReason } from "@/types/inventory";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeWaste(
  restaurantId: string,
  branchId: string,
  onData: (rows: WasteEntry[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "waste"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as WasteEntry)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function recordWaste(input: {
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  quantity: number;
  reason: WasteReason;
  costPerUnit: number;
  createdBy: string;
  note?: string;
}): Promise<WasteEntry> {
  const stamp = nowIso();
  const id = newId("wst");
  const row: WasteEntry = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
    ingredientName: input.ingredientName,
    quantity: input.quantity,
    unit: input.unit,
    reason: input.reason,
    note: input.note,
    costImpact: Math.round(input.quantity * input.costPerUnit * 100) / 100,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
  };

  await applyStockDelta({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
    unit: input.unit,
    delta: -input.quantity,
    type: "waste",
    createdBy: input.createdBy,
    referenceType: "waste",
    referenceId: id,
    note: input.note ?? input.reason,
    movementId: `waste:${id}`,
  });

  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "waste", id), row);
  await batch.commit();
  return row;
}
