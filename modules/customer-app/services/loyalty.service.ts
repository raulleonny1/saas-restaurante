"use client";

import { getDb } from "@/lib/firebase";
import type { LoyaltyAccount, LoyaltyTransaction } from "@/types/customers";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";

export function subscribeLoyaltyAccount(
  restaurantId: string,
  customerId: string,
  onData: (account: LoyaltyAccount | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "restaurants", restaurantId, "loyaltyAccounts", customerId),
    (snap) => {
      onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as LoyaltyAccount) : null);
    },
    (err) => onError?.(err),
  );
}

export function subscribeLoyaltyTx(
  restaurantId: string,
  customerId: string,
  onData: (rows: LoyaltyTransaction[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "loyaltyTransactions"),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as LoyaltyTransaction)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}
