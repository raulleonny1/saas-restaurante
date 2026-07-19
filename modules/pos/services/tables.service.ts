"use client";

import { getDb } from "@/lib/firebase";
import type { Table, TableStatus } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeTables(
  restaurantId: string,
  branchId: string,
  onData: (tables: Table[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "tables"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Table)
        .filter((t) => !t.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(list);
    },
    (err) => onError?.(err),
  );
}

export async function updateTableStatus(
  restaurantId: string,
  tableId: string,
  patch: Partial<
    Pick<Table, "status" | "currentOrderId" | "mergedWith" | "updatedAt">
  >,
) {
  const ref = doc(getDb(), "restaurants", restaurantId, "tables", tableId);
  const batch = writeBatch(getDb());
  batch.update(ref, { ...patch, updatedAt: new Date().toISOString() });
  await batch.commit();
}

export async function setTablesStatus(
  restaurantId: string,
  updates: Array<{
    tableId: string;
    status: TableStatus;
    currentOrderId?: string | null;
    mergedWith?: string[];
  }>,
) {
  const batch = writeBatch(getDb());
  const now = new Date().toISOString();
  for (const u of updates) {
    const ref = doc(getDb(), "restaurants", restaurantId, "tables", u.tableId);
    batch.update(ref, {
      status: u.status,
      currentOrderId: u.currentOrderId ?? null,
      mergedWith: u.mergedWith ?? [],
      updatedAt: now,
    });
  }
  await batch.commit();
}
