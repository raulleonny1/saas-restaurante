"use client";

import { getDb } from "@/lib/firebase";
import { recalculateOrder, roundMoney } from "@/modules/pos/domain/totals";
import type { CurrencyCode } from "@/types/common";
import type {
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Table,
} from "@/types/orders";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function appendEvent(
  restaurantId: string,
  event: Omit<OrderEvent, "id" | "createdAt" | "updatedAt">,
) {
  const id = newId("evt");
  const ref = doc(getDb(), "restaurants", restaurantId, "orderEvents", id);
  const batch = writeBatch(getDb());
  const stamp = nowIso();
  batch.set(ref, { ...event, id, createdAt: stamp, updatedAt: stamp });
  await batch.commit();
}

const OPEN_STATUSES: OrderStatus[] = [
  "open",
  "sent",
  "preparing",
  "ready",
  "delivered",
];

export function subscribeOpenOrders(
  restaurantId: string,
  branchId: string,
  onData: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Order)
          .filter((o) => !o.deletedAt && OPEN_STATUSES.includes(o.status)),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeOrder(
  restaurantId: string,
  orderId: string,
  onData: (order: Order | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = doc(getDb(), "restaurants", restaurantId, "orders", orderId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() } as Order);
    },
    (err) => onError?.(err),
  );
}

export function subscribeRecentPaidOrders(
  restaurantId: string,
  branchId: string,
  onData: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Order)
          .filter(
            (o) =>
              !o.deletedAt &&
              (o.status === "paid" ||
                o.status === "cancelled" ||
                Boolean(o.refundedAt)),
          )
          .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
          .slice(0, 80),
      );
    },
    (err) => onError?.(err),
  );
}

export interface OpenTableInput {
  restaurantId: string;
  branchId: string;
  table: Table;
  uid: string;
  currency: CurrencyCode;
  taxPercent: number;
  tipDefaultPercent: number;
  guestCount?: number;
}

export async function openTable(input: OpenTableInput): Promise<Order> {
  const { restaurantId, branchId, table, uid, currency, tipDefaultPercent } =
    input;
  if (table.status === "occupied" && table.currentOrderId) {
    const existing = await getDoc(
      doc(getDb(), "restaurants", restaurantId, "orders", table.currentOrderId),
    );
    if (existing.exists()) {
      return { id: existing.id, ...existing.data() } as Order;
    }
  }

  const orderId = newId("ord");
  const stamp = nowIso();
  const order: Order = {
    id: orderId,
    restaurantId,
    branchId,
    tableId: table.id,
    tableName: table.name,
    mergedTableIds: [],
    channel: "pos",
    items: [],
    status: "open",
    discountPercent: 0,
    discountAmount: 0,
    tipPercent: tipDefaultPercent,
    tipAmount: 0,
    taxAmount: 0,
    subtotal: 0,
    total: 0,
    amountPaid: 0,
    currency,
    guestCount: input.guestCount ?? 2,
    openedAt: stamp,
    createdBy: uid,
    servedBy: uid,
    printCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", restaurantId, "orders", orderId), order);
  batch.update(doc(getDb(), "restaurants", restaurantId, "tables", table.id), {
    status: "occupied",
    currentOrderId: orderId,
    mergedWith: [],
    updatedAt: stamp,
  });
  await batch.commit();

  await appendEvent(restaurantId, {
    restaurantId,
    branchId,
    orderId,
    type: "table.opened",
    toStatus: "open",
    actorUid: uid,
    payload: { tableId: table.id, tableName: table.name },
  });

  return order;
}

export async function patchOrderTotals(
  restaurantId: string,
  order: Order,
  taxPercent: number,
  patch: Partial<
    Pick<
      Order,
      | "items"
      | "discountPercent"
      | "discountAmount"
      | "tipPercent"
      | "tipAmount"
      | "guestCount"
      | "notes"
      | "splitParts"
      | "splitSeats"
      | "mergedTableIds"
      | "tableId"
      | "tableName"
      | "status"
      | "sentAt"
      | "amountPaid"
      | "paidAt"
      | "refundedAt"
      | "printCount"
      | "lastPrintedAt"
    >
  >,
  actorUid: string,
  eventType = "order.updated",
): Promise<Order> {
  const merged: Order = { ...order, ...patch };
  const totals = recalculateOrder(merged, taxPercent);
  const next: Order = {
    ...merged,
    ...totals,
    updatedAt: nowIso(),
  };

  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", restaurantId, "orders", order.id), next);
  await batch.commit();

  await appendEvent(restaurantId, {
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    type: eventType,
    fromStatus: order.status,
    toStatus: next.status,
    actorUid,
    payload: { keys: Object.keys(patch) },
  });

  return next;
}

/** Safer update via updateDoc-compatible batch set merge. */
export async function saveOrder(
  restaurantId: string,
  order: Order,
  taxPercent: number,
  actorUid: string,
  eventType?: string,
): Promise<Order> {
  const totals = recalculateOrder(order, taxPercent);
  const next: Order = {
    ...order,
    ...totals,
    amountPaid: order.amountPaid ?? 0,
    updatedAt: nowIso(),
  };
  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", restaurantId, "orders", order.id), next);
  await batch.commit();

  if (eventType) {
    await appendEvent(restaurantId, {
      restaurantId,
      branchId: order.branchId,
      orderId: order.id,
      type: eventType,
      fromStatus: order.status,
      toStatus: next.status,
      actorUid,
    });
  }
  return next;
}

export async function addItemToOrder(
  restaurantId: string,
  order: Order,
  item: OrderItem,
  taxPercent: number,
  actorUid: string,
): Promise<Order> {
  const items = [...order.items, item];
  return saveOrder(
    restaurantId,
    { ...order, items },
    taxPercent,
    actorUid,
    "item.added",
  );
}

export async function updateOrderItem(
  restaurantId: string,
  order: Order,
  itemId: string,
  patch: Partial<OrderItem>,
  taxPercent: number,
  actorUid: string,
): Promise<Order> {
  const items = order.items.map((i) =>
    i.id === itemId ? { ...i, ...patch } : i,
  );
  return saveOrder(
    restaurantId,
    { ...order, items },
    taxPercent,
    actorUid,
    "item.updated",
  );
}

export async function removeOrderItem(
  restaurantId: string,
  order: Order,
  itemId: string,
  taxPercent: number,
  actorUid: string,
): Promise<Order> {
  const items = order.items.filter((i) => i.id !== itemId);
  return saveOrder(
    restaurantId,
    { ...order, items },
    taxPercent,
    actorUid,
    "item.removed",
  );
}

export async function sendToKitchen(
  restaurantId: string,
  order: Order,
  taxPercent: number,
  actorUid: string,
): Promise<Order> {
  const stamp = nowIso();
  const items = order.items.map((item) =>
    item.status === "open" || !item.sentAt
      ? { ...item, status: "sent" as OrderStatus, sentAt: item.sentAt ?? stamp }
      : item,
  );
  return saveOrder(
    restaurantId,
    {
      ...order,
      items,
      status: order.status === "open" ? "sent" : order.status,
      sentAt: order.sentAt ?? stamp,
    },
    taxPercent,
    actorUid,
    "kitchen.sent",
  );
}

export async function moveOrderToTable(
  restaurantId: string,
  order: Order,
  fromTable: Table,
  toTable: Table,
  actorUid: string,
): Promise<void> {
  if (toTable.status === "occupied" && toTable.currentOrderId) {
    throw new Error("La mesa destino ya tiene un pedido abierto");
  }
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "orders", order.id), {
    tableId: toTable.id,
    tableName: toTable.name,
    updatedAt: stamp,
  });
  batch.update(doc(getDb(), "restaurants", restaurantId, "tables", fromTable.id), {
    status: "available",
    currentOrderId: null,
    mergedWith: [],
    updatedAt: stamp,
  });
  batch.update(doc(getDb(), "restaurants", restaurantId, "tables", toTable.id), {
    status: "occupied",
    currentOrderId: order.id,
    mergedWith: order.mergedTableIds ?? [],
    updatedAt: stamp,
  });
  // keep merged satellite tables pointing at same order
  for (const mid of order.mergedTableIds ?? []) {
    batch.update(doc(getDb(), "restaurants", restaurantId, "tables", mid), {
      currentOrderId: order.id,
      updatedAt: stamp,
    });
  }
  await batch.commit();
  await appendEvent(restaurantId, {
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    type: "table.moved",
    actorUid,
    payload: { from: fromTable.id, to: toTable.id },
  });
}

export async function mergeTables(
  restaurantId: string,
  primaryOrder: Order,
  primaryTable: Table,
  secondary: { table: Table; order: Order | null }[],
  taxPercent: number,
  actorUid: string,
): Promise<Order> {
  const stamp = nowIso();
  let items = [...primaryOrder.items];
  const mergedIds = new Set(primaryOrder.mergedTableIds ?? []);

  const batch = writeBatch(getDb());

  for (const sec of secondary) {
    mergedIds.add(sec.table.id);
    if (sec.order && sec.order.id !== primaryOrder.id) {
      items = [
        ...items,
        ...sec.order.items.map((i) => ({ ...i, id: newId("li") })),
      ];
      batch.update(
        doc(getDb(), "restaurants", restaurantId, "orders", sec.order.id),
        {
          status: "cancelled",
          cancelledAt: stamp,
          notes: `Fusionado en ${primaryOrder.id}`,
          updatedAt: stamp,
        },
      );
    }
    batch.update(
      doc(getDb(), "restaurants", restaurantId, "tables", sec.table.id),
      {
        status: "occupied",
        currentOrderId: primaryOrder.id,
        mergedWith: [primaryTable.id],
        updatedAt: stamp,
      },
    );
  }

  const nextBase: Order = {
    ...primaryOrder,
    items,
    mergedTableIds: [...mergedIds],
    guestCount: Math.max(
      primaryOrder.guestCount,
      ...secondary.map((s) => s.order?.guestCount ?? s.table.seats),
    ),
  };
  const totals = recalculateOrder(nextBase, taxPercent);
  const next: Order = { ...nextBase, ...totals, updatedAt: stamp };

  batch.set(
    doc(getDb(), "restaurants", restaurantId, "orders", primaryOrder.id),
    next,
  );
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "tables", primaryTable.id),
    {
      mergedWith: [...mergedIds],
      updatedAt: stamp,
    },
  );
  await batch.commit();

  await appendEvent(restaurantId, {
    restaurantId,
    branchId: primaryOrder.branchId,
    orderId: primaryOrder.id,
    type: "tables.merged",
    actorUid,
    payload: { mergedTableIds: [...mergedIds] },
  });

  return next;
}

export async function markPrinted(
  restaurantId: string,
  order: Order,
  actorUid: string,
): Promise<void> {
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "orders", order.id), {
    printCount: (order.printCount ?? 0) + 1,
    lastPrintedAt: stamp,
    updatedAt: stamp,
  });
  await batch.commit();
  await appendEvent(restaurantId, {
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    type: "receipt.printed",
    actorUid,
  });
}

export { newId, roundMoney };
