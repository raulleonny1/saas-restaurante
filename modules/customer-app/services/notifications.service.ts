"use client";

import { getDb } from "@/lib/firebase";
import { nowIso } from "@/modules/customer-app/domain/ids";
import type { AppNotification } from "@/types/notifications";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";

export function subscribeMyNotifications(
  restaurantId: string,
  uid: string,
  onData: (rows: AppNotification[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "appNotifications"),
    where("uid", "==", uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AppNotification)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function markNotificationRead(input: {
  restaurantId: string;
  notificationId: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "appNotifications",
      input.notificationId,
    ),
    { read: true, readAt: nowIso(), updatedAt: nowIso() },
  );
}
