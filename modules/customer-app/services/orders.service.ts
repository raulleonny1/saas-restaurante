"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/customer-app/domain/ids";
import type { Order } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
} from "firebase/firestore";

export function subscribeMyOrders(
  restaurantId: string,
  customerUid: string,
  onData: (rows: Order[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("customerUid", "==", customerUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Order)
          .filter((o) => !o.deletedAt)
          .sort((a, b) =>
            (b.openedAt || b.createdAt).localeCompare(a.openedAt || a.createdAt),
          ),
      );
    },
    (err) => onError?.(err),
  );
}

export async function placeCustomerOrder(input: {
  restaurantId: string;
  branchId: string;
  customerId: string;
  customerUid: string;
  customerName: string;
  customerPhone?: string;
  notes?: string;
  currency: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}): Promise<Order> {
  const stamp = nowIso();
  const id = newId("ord");
  const subtotal = input.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0,
  );
  const row: Order & { customerUid: string } = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerId: input.customerId,
    customerUid: input.customerUid,
    channel: "online",
    items: input.items.map((i, idx) => ({
      id: `li_${idx}`,
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      status: "open",
    })),
    status: "open",
    discountPercent: 0,
    discountAmount: 0,
    tipPercent: 0,
    tipAmount: 0,
    taxAmount: 0,
    subtotal,
    total: subtotal,
    amountPaid: 0,
    currency: input.currency as Order["currency"],
    guestCount: 1,
    openedAt: stamp,
    createdBy: input.customerUid,
    notes: [input.customerName, input.customerPhone, input.notes]
      .filter(Boolean)
      .join(" · "),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "orders", id),
    stripUndefined({ ...row }),
  );

  // Notify customer + staff (best-effort)
  try {
    const customerNtf = newId("ntf");
    await setDoc(
      doc(
        getDb(),
        "restaurants",
        input.restaurantId,
        "appNotifications",
        customerNtf,
      ),
      stripUndefined({
        id: customerNtf,
        restaurantId: input.restaurantId,
        uid: input.customerUid,
        type: "order",
        title: "Pedido recibido",
        body: `Tu pedido ···${id.slice(-6)} está en cocina.`,
        href: "/seguimiento",
        read: false,
        referenceType: "order",
        referenceId: id,
        createdAt: stamp,
        updatedAt: stamp,
      }),
    );
  } catch {
    /* ignore */
  }

  return row;
}
