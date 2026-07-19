"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/inventory/domain/ids";
import { applyStockDelta } from "@/modules/inventory/services/stock.service";
import type { StockTransfer, TransferItem } from "@/types/inventory";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeTransfers(
  restaurantId: string,
  onData: (rows: StockTransfer[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "transfers"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as StockTransfer)
          .filter((t) => !t.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function createTransfer(input: {
  restaurantId: string;
  fromBranchId: string;
  toBranchId: string;
  items: TransferItem[];
  createdBy: string;
  notes?: string;
}): Promise<StockTransfer> {
  if (input.fromBranchId === input.toBranchId) {
    throw new Error("Origen y destino deben ser distintos");
  }
  const stamp = nowIso();
  const id = newId("trf");
  const row: StockTransfer = {
    id,
    restaurantId: input.restaurantId,
    fromBranchId: input.fromBranchId,
    toBranchId: input.toBranchId,
    status: "in_transit",
    items: input.items,
    createdBy: input.createdBy,
    notes: input.notes,
    shippedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  for (const item of input.items) {
    await applyStockDelta({
      restaurantId: input.restaurantId,
      branchId: input.fromBranchId,
      ingredientId: item.ingredientId,
      unit: item.unit,
      delta: -item.quantity,
      type: "transfer_out",
      createdBy: input.createdBy,
      referenceType: "transfer",
      referenceId: id,
      note: `Transferencia salida → ${input.toBranchId}`,
      movementId: `transfer_out:${id}:${item.ingredientId}`,
    });
  }

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "transfers", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function receiveTransfer(input: {
  restaurantId: string;
  transfer: StockTransfer;
  actorUid: string;
}): Promise<void> {
  if (input.transfer.status === "received") return;
  const stamp = nowIso();

  for (const item of input.transfer.items) {
    await applyStockDelta({
      restaurantId: input.restaurantId,
      branchId: input.transfer.toBranchId,
      ingredientId: item.ingredientId,
      unit: item.unit,
      delta: item.quantity,
      type: "transfer_in",
      createdBy: input.actorUid,
      referenceType: "transfer",
      referenceId: input.transfer.id,
      note: `Transferencia entrada ← ${input.transfer.fromBranchId}`,
      movementId: `transfer_in:${input.transfer.id}:${item.ingredientId}`,
    });
  }

  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "transfers",
      input.transfer.id,
    ),
    {
      status: "received",
      receivedAt: stamp,
      updatedAt: stamp,
    },
  );
  await batch.commit();
}
