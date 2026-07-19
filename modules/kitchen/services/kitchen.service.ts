"use client";

import { getDb } from "@/lib/firebase";
import {
  columnToStatus,
  itemToColumn,
} from "@/modules/kitchen/domain/priority";
import {
  isDrinkStation,
  resolveItemStation,
  stationMatchesBoard,
  targetPrepMinutes,
  type KitchenBoardMode,
} from "@/modules/kitchen/domain/stations";
import type { Product, ProductCategory } from "@/types/catalog";
import type {
  KitchenColumnId,
  KitchenStationId,
  KitchenTicket,
  KitchenTicketItem,
} from "@/types/kitchen";
import type { Order, OrderItem, OrderStatus } from "@/types/orders";
import type { Branch } from "@/types/restaurant";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  calcPriority,
  itemElapsedMs,
  maxPriority,
} from "@/modules/kitchen/domain/priority";

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "open",
  "sent",
  "preparing",
  "ready",
  "delivered",
];

function nowIso() {
  return new Date().toISOString();
}

export function subscribeKitchenBranches(
  restaurantId: string,
  onData: (branches: Branch[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "branches"),
    orderBy("name", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Branch)
          .filter((b) => !b.deletedAt),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeKitchenCatalog(
  restaurantId: string,
  onData: (products: Product[], categories: ProductCategory[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  let products: Product[] = [];
  let categories: ProductCategory[] = [];

  const emit = () => onData(products, categories);

  unsubs.push(
    onSnapshot(
      collection(getDb(), "restaurants", restaurantId, "products"),
      (snap) => {
        products = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Product)
          .filter((p) => !p.deletedAt);
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      collection(getDb(), "restaurants", restaurantId, "categories"),
      (snap) => {
        categories = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ProductCategory)
          .filter((c) => !c.deletedAt);
        emit();
      },
      (err) => onError?.(err),
    ),
  );

  return () => unsubs.forEach((u) => u());
}

export function subscribeKitchenOrders(
  restaurantId: string,
  branchId: string,
  onData: (orders: Order[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const col = collection(getDb(), "restaurants", restaurantId, "orders");
  const mapActive = (snap: { docs: { id: string; data: () => object }[] }) =>
    snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Order)
      .filter(
        (o) =>
          !o.deletedAt &&
          ACTIVE_ORDER_STATUSES.includes(o.status) &&
          o.status !== "paid" &&
          o.status !== "cancelled",
      );

  let unsub: Unsubscribe = () => {};
  const prefer = query(
    col,
    where("branchId", "==", branchId),
    where("status", "in", ACTIVE_ORDER_STATUSES),
  );
  unsub = onSnapshot(
    prefer,
    (snap) => onData(mapActive(snap)),
    (err) => {
      if (!/index|failed-precondition/i.test(err.message)) {
        onError?.(err);
        return;
      }
      unsub();
      unsub = onSnapshot(
        query(col, where("branchId", "==", branchId)),
        (snap) => onData(mapActive(snap)),
        (e2) => onError?.(e2),
      );
    },
  );
  return () => unsub();
}

export function buildKitchenTickets(input: {
  orders: Order[];
  products: Product[];
  categories: ProductCategory[];
  /** Estación concreta, o todas las del tablero (cocina / bar). */
  station?: KitchenStationId;
  board?: KitchenBoardMode;
  includeDelivered: boolean;
  now?: number;
}): KitchenTicket[] {
  const now = input.now ?? Date.now();
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const tickets: KitchenTicket[] = [];
  const board = input.board ?? "kitchen";

  for (const order of input.orders) {
    const stationItems: KitchenTicketItem[] = [];

    for (const item of order.items) {
      const product = productById.get(item.productId);
      const category = product
        ? categoryById.get(product.categoryId)
        : undefined;
      const station = resolveItemStation(item, product, category);
      if (input.station) {
        const match =
          input.station === "bar"
            ? isDrinkStation(station)
            : station === input.station;
        if (!match) continue;
      } else if (!stationMatchesBoard(station, board)) {
        continue;
      }

      // Only show lines that were sent to kitchen (or already in KDS flow)
      const column = itemToColumn(item.status);
      if (!column) continue;
      if (item.status === "open" && !item.sentAt) continue;
      if (column === "delivered" && !input.includeDelivered) continue;
      // Treat open+sentAt as queued
      const effectiveColumn =
        item.status === "open" && item.sentAt ? "queued" : column;
      if (effectiveColumn === "delivered" && !input.includeDelivered) continue;

      const targetMin = targetPrepMinutes(product, station);
      const targetPrepMs = targetMin * 60_000;
      const elapsedMs = itemElapsedMs(
        {
          ...item,
          status: item.status === "open" && item.sentAt ? "sent" : item.status,
        },
        now,
      );
      const priority = calcPriority(elapsedMs, targetPrepMs);

      stationItems.push({
        item,
        station,
        column: effectiveColumn,
        priority,
        elapsedMs,
        targetPrepMs,
      });
    }

    if (!stationItems.length) continue;

    const priority = stationItems.reduce(
      (acc, i) => maxPriority(acc, i.priority),
      "normal" as ReturnType<typeof calcPriority>,
    );
    const elapsedMs = Math.max(...stationItems.map((i) => i.elapsedMs));
    const bumpedAt =
      stationItems
        .map((i) => i.item.sentAt || i.item.startedAt || order.sentAt || order.openedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? order.updatedAt;

    tickets.push({
      order,
      station: input.station ?? stationItems[0]!.station,
      items: stationItems,
      bumpedAt,
      priority,
      elapsedMs,
    });
  }

  return tickets.sort((a, b) => {
    const rank = { critical: 3, urgent: 2, warning: 1, normal: 0 };
    const d = rank[b.priority] - rank[a.priority];
    if (d !== 0) return d;
    return a.bumpedAt.localeCompare(b.bumpedAt);
  });
}

function patchItemToColumn(
  item: OrderItem,
  toColumn: KitchenColumnId,
  stamp: string,
): OrderItem {
  const nextStatus = columnToStatus(toColumn);
  const patch: OrderItem = { ...item, status: nextStatus };
  if (toColumn === "queued") {
    patch.status = "sent";
    patch.sentAt = item.sentAt ?? stamp;
  }
  if (toColumn === "preparing") {
    patch.startedAt = item.startedAt ?? stamp;
  }
  if (toColumn === "ready") {
    patch.readyAt = stamp;
    patch.startedAt = item.startedAt ?? stamp;
  }
  if (toColumn === "delivered") {
    patch.deliveredAt = stamp;
    patch.readyAt = item.readyAt ?? stamp;
  }
  return patch;
}

function deriveOrderStatus(items: OrderItem[], fallback: OrderStatus): OrderStatus {
  const kitchenStatuses = items
    .filter(
      (i) =>
        i.sentAt ||
        ["sent", "preparing", "ready", "delivered"].includes(i.status),
    )
    .map((i) => i.status);

  if (!kitchenStatuses.length) return fallback;
  if (kitchenStatuses.every((s) => s === "delivered")) return "delivered";
  if (kitchenStatuses.some((s) => s === "ready")) return "ready";
  if (kitchenStatuses.some((s) => s === "preparing")) return "preparing";
  if (kitchenStatuses.some((s) => s === "sent")) return "sent";
  return fallback;
}

export async function advanceKitchenItem(input: {
  restaurantId: string;
  order: Order;
  itemId: string;
  toColumn: KitchenColumnId;
  actorUid: string;
}): Promise<void> {
  return advanceTicketColumn({
    restaurantId: input.restaurantId,
    order: input.order,
    itemIds: [input.itemId],
    toColumn: input.toColumn,
    actorUid: input.actorUid,
  });
}

export async function advanceTicketColumn(input: {
  restaurantId: string;
  order: Order;
  itemIds: string[];
  toColumn: KitchenColumnId;
  actorUid: string;
}): Promise<void> {
  const { restaurantId, order, itemIds, toColumn, actorUid } = input;
  if (!itemIds.length) return;
  const stamp = nowIso();
  const idSet = new Set(itemIds);

  const items = order.items.map((item) =>
    idSet.has(item.id) ? patchItemToColumn(item, toColumn, stamp) : item,
  );
  const orderStatus = deriveOrderStatus(items, order.status);

  const readyBody =
    toColumn === "ready"
      ? items
          .filter((i) => idSet.has(i.id))
          .map((i) => `${i.quantity}× ${i.name}`)
          .join(", ")
      : undefined;
  const stillHasReady = items.some((i) => i.status === "ready");

  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "orders", order.id), {
    items,
    status: orderStatus,
    updatedAt: stamp,
    ...(toColumn === "ready"
      ? {
          waiterAlertAt: stamp,
          waiterAlertBody: readyBody || "Pedido listo para llevar a la mesa",
        }
      : !stillHasReady
        ? {
            waiterAlertAt: deleteField(),
            waiterAlertBody: deleteField(),
          }
        : {}),
  });

  const evtId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  batch.set(doc(getDb(), "restaurants", restaurantId, "orderEvents", evtId), {
    id: evtId,
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    type: "kitchen.item_status",
    fromStatus: order.status,
    toStatus: orderStatus,
    actorUid,
    payload: { itemIds, toColumn },
    createdAt: stamp,
    updatedAt: stamp,
  });

  await batch.commit();
}

/**
 * Cocina avisa al mesero: marca líneas como listas + dispara aviso flotante/sonido.
 * Se puede repetir (re-alerta) aunque ya estén en «Listo».
 */
export async function alertWaiterForOrder(input: {
  restaurantId: string;
  order: Order;
  itemIds: string[];
  actorUid: string;
}): Promise<void> {
  const { restaurantId, order, itemIds, actorUid } = input;
  if (!itemIds.length) return;
  const stamp = nowIso();
  const idSet = new Set(itemIds);

  const items = order.items.map((item) => {
    if (!idSet.has(item.id)) return item;
    if (item.status === "delivered" || item.status === "cancelled") return item;
    if (item.status === "ready") {
      return { ...item, readyAt: item.readyAt ?? stamp };
    }
    return patchItemToColumn(item, "ready", stamp);
  });

  const alertItems = items.filter(
    (i) => idSet.has(i.id) && i.status === "ready",
  );
  const body =
    alertItems.map((i) => `${i.quantity}× ${i.name}`).join(", ") ||
    "Pedido listo para llevar a la mesa";
  const orderStatus = deriveOrderStatus(items, order.status);

  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "orders", order.id), {
    items,
    status: orderStatus,
    updatedAt: stamp,
    waiterAlertAt: stamp,
    waiterAlertBody: body,
  });

  const evtId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  batch.set(doc(getDb(), "restaurants", restaurantId, "orderEvents", evtId), {
    id: evtId,
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    type: "kitchen.waiter_alert",
    fromStatus: order.status,
    toStatus: orderStatus,
    actorUid,
    payload: { itemIds, body },
    createdAt: stamp,
    updatedAt: stamp,
  });

  await batch.commit();
}
