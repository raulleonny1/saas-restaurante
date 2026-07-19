"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/customers/domain/ids";
import type {
  CustomerHistoryEntry,
  CustomerHistoryType,
} from "@/types/customers";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeCustomerHistory(
  restaurantId: string,
  customerId: string,
  onData: (rows: CustomerHistoryEntry[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "customerHistory"),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CustomerHistoryEntry)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 120),
      );
    },
    (err) => onError?.(err),
  );
}

export async function appendHistory(input: {
  restaurantId: string;
  customerId: string;
  branchId?: string | null;
  type: CustomerHistoryType;
  title: string;
  description?: string;
  referenceType?: CustomerHistoryEntry["referenceType"];
  referenceId?: string;
  pointsDelta?: number;
  amount?: number;
  actorUid?: string;
  entryId?: string;
}): Promise<CustomerHistoryEntry> {
  const stamp = nowIso();
  const id = input.entryId ?? newId("chist");
  const row: CustomerHistoryEntry = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId ?? null,
    customerId: input.customerId,
    type: input.type,
    title: input.title,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    pointsDelta: input.pointsDelta,
    amount: input.amount,
    actorUid: input.actorUid,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "customerHistory", id),
    row,
  );
  await batch.commit();
  return row;
}
