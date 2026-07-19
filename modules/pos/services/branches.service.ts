"use client";

import { getDb } from "@/lib/firebase";
import type { Branch } from "@/types/restaurant";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
} from "firebase/firestore";

export function subscribeBranches(
  restaurantId: string,
  onData: (branches: Branch[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "branches"),
    orderBy("name", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
      onData(list.filter((b) => !b.deletedAt));
    },
    (err) => onError?.(err),
  );
}
