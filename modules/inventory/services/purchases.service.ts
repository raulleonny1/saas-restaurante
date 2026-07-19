"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/inventory/domain/ids";
import { applyStockDelta } from "@/modules/inventory/services/stock.service";
import type { CurrencyCode } from "@/types/common";
import type { Purchase, PurchaseItem, PurchaseStatus } from "@/types/inventory";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribePurchases(
  restaurantId: string,
  branchId: string,
  onData: (rows: Purchase[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "purchases"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Purchase)
          .filter((p) => !p.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function createPurchase(input: {
  restaurantId: string;
  branchId: string;
  supplierId: string;
  items: PurchaseItem[];
  currency: CurrencyCode;
  taxPercent: number;
  createdBy: string;
  notes?: string;
}): Promise<Purchase> {
  const stamp = nowIso();
  const id = newId("pur");
  const subtotal = input.items.reduce(
    (s, i) => s + i.quantity * i.unitCost,
    0,
  );
  const tax = Math.round(subtotal * (input.taxPercent / 100) * 100) / 100;
  const row: Purchase = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    supplierId: input.supplierId,
    status: "ordered",
    items: input.items,
    subtotal,
    tax,
    total: subtotal + tax,
    currency: input.currency,
    orderedAt: stamp,
    createdBy: input.createdBy,
    notes: input.notes,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "purchases", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function receivePurchase(input: {
  restaurantId: string;
  purchase: Purchase;
  actorUid: string;
}): Promise<void> {
  if (input.purchase.status === "received") return;
  const stamp = nowIso();

  for (const item of input.purchase.items) {
    await applyStockDelta({
      restaurantId: input.restaurantId,
      branchId: input.purchase.branchId,
      ingredientId: item.ingredientId,
      unit: item.unit,
      delta: item.quantity,
      type: "purchase",
      createdBy: input.actorUid,
      referenceType: "purchase",
      referenceId: input.purchase.id,
      note: `Compra recibida ${input.purchase.id.slice(0, 8)}`,
      movementId: `purchase:${input.purchase.id}:${item.ingredientId}`,
    });
  }

  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "purchases",
      input.purchase.id,
    ),
    {
      status: "received" as PurchaseStatus,
      receivedAt: stamp,
      updatedAt: stamp,
    },
  );
  await batch.commit();
}
