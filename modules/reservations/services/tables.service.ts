"use client";

import { getDb } from "@/lib/firebase";
import type { Table } from "@/types/orders";
import {
  collection,
  onSnapshot,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";

export function subscribeReservationTables(
  restaurantId: string,
  branchId: string,
  onData: (tables: Table[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "tables"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Table)
          .filter((t) => !t.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}
