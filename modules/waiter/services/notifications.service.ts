"use client";

import { getDb } from "@/lib/firebase";
import type { AppNotification } from "@/types/notifications";
import type { Order } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";

export function subscribeStaffNotifications(
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

export async function markStaffNotificationRead(input: {
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
    {
      read: true,
      readAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );
}

/** Solo si hay líneas realmente listas para retirar (no avisos viejos). */
export function kitchenReadyAlerts(orders: Order[]): AppNotification[] {
  return orders
    .filter((o) => {
      if (o.status === "paid" || o.status === "cancelled") return false;
      return o.items.some((i) => i.status === "ready");
    })
    .map((o) => {
      const readyItems = o.items.filter((i) => i.status === "ready");
      const body =
        o.waiterAlertBody ||
        readyItems.map((i) => `${i.quantity}× ${i.name}`).join(", ") ||
        "Pedido listo para llevar a la mesa";
      const stamp = o.waiterAlertAt ?? readyItems[0]?.readyAt ?? o.updatedAt;
      return {
        id: `ready_${o.id}_${stamp}`,
        restaurantId: o.restaurantId,
        uid: "local",
        type: "order" as const,
        title: `¡Retirar de cocina! · ${o.tableName ?? "Mesa"}`,
        body,
        href: "/waiter/pedido",
        read: false,
        referenceType: "order" as const,
        referenceId: o.id,
        createdAt: stamp,
        updatedAt: o.updatedAt,
      };
    });
}
