"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { DeliveryStatus, Order } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";

const DELIVERY_CHANNELS = ["delivery", "takeaway", "online"] as const;

export function isDeliveryChannel(channel: string): boolean {
  return (DELIVERY_CHANNELS as readonly string[]).includes(channel);
}

export function subscribeDeliveryOrders(
  restaurantId: string,
  branchId: string | null,
  onData: (orders: Order[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const col = collection(getDb(), "restaurants", restaurantId, "orders");
  const q = branchId
    ? query(col, where("branchId", "==", branchId))
    : query(col);

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Order)
        .filter(
          (o) =>
            !o.deletedAt &&
            isDeliveryChannel(o.channel) &&
            o.status !== "cancelled" &&
            o.deliveryStatus !== "delivered" &&
            o.deliveryStatus !== "cancelled",
        )
        .sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || ""));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function setDeliveryStatus(input: {
  restaurantId: string;
  orderId: string;
  status: DeliveryStatus;
  assignedTo?: string | null;
  assignedName?: string | null;
}): Promise<void> {
  const stamp = new Date().toISOString();
  const patch: Record<string, unknown> = {
    deliveryStatus: input.status,
    updatedAt: stamp,
  };
  if (input.status === "assigned") {
    patch.deliveryAssignedTo = input.assignedTo ?? null;
    patch.deliveryAssignedName = input.assignedName ?? null;
    patch.deliveryAssignedAt = stamp;
  }
  if (input.status === "en_route") {
    patch.deliveryPickedUpAt = stamp;
  }
  if (input.status === "delivered") {
    patch.deliveryDeliveredAt = stamp;
    patch.status = "delivered";
  }
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "orders", input.orderId),
    stripUndefined(patch),
  );
}

export function deliveryStatusLabel(s?: DeliveryStatus | null): string {
  switch (s) {
    case "preparing":
      return "Preparando";
    case "ready":
      return "Listo";
    case "assigned":
      return "Asignado";
    case "en_route":
      return "En camino";
    case "delivered":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendiente";
  }
}
