"use client";

import { getDb } from "@/lib/firebase";
import { nowIso, roundMoney } from "@/modules/customers/domain/ids";
import {
  computeSegments,
  computeValueScore,
  deriveTier,
} from "@/modules/customers/domain/segments";
import { appendHistory } from "@/modules/customers/services/history.service";
import { adjustPoints } from "@/modules/customers/services/loyalty.service";
import type { Customer } from "@/types/customers";
import type { Order } from "@/types/orders";
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

/** ~1 point per euro spent */
function pointsFromOrder(total: number): number {
  return Math.max(0, Math.floor(total));
}

export function subscribeCustomerOrders(
  restaurantId: string,
  customerId: string,
  onData: (orders: Order[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Order)
          .sort((a, b) =>
            (b.paidAt ?? b.updatedAt).localeCompare(a.paidAt ?? a.updatedAt),
          )
          .slice(0, 80),
      );
    },
    (err) => onError?.(err),
  );
}

/**
 * Apply CRM side-effects for a paid order linked to a customer.
 * Idempotent via loyalty tx id + history entry id.
 */
export async function applyPaidOrderToCrm(input: {
  restaurantId: string;
  order: Order;
  actorUid: string;
}): Promise<void> {
  const { restaurantId, order, actorUid } = input;
  if (!order.customerId) return;
  if (order.status !== "paid" && !order.paidAt) return;

  const custRef = doc(
    getDb(),
    "restaurants",
    restaurantId,
    "customers",
    order.customerId,
  );
  const snap = await getDoc(custRef);
  if (!snap.exists()) return;

  const customer = { id: snap.id, ...snap.data() } as Customer;
  const stamp = nowIso();
  const earn = pointsFromOrder(order.total);

  const histId = `hist_order_${order.id}`;
  const histSnap = await getDoc(
    doc(getDb(), "restaurants", restaurantId, "customerHistory", histId),
  );
  if (histSnap.exists()) {
    // Still ensure loyalty earn is idempotent if history was written first
    await adjustPoints({
      restaurantId,
      customerId: order.customerId,
      points: earn,
      type: "earn",
      createdBy: actorUid,
      branchId: order.branchId,
      referenceType: "order",
      referenceId: order.id,
      note: `Pedido ${order.tableName ?? order.id.slice(0, 8)}`,
      transactionId: `earn_order_${order.id}`,
    });
    return;
  }

  await adjustPoints({
    restaurantId,
    customerId: order.customerId,
    points: earn,
    type: "earn",
    createdBy: actorUid,
    branchId: order.branchId,
    referenceType: "order",
    referenceId: order.id,
    note: `Pedido ${order.tableName ?? order.id.slice(0, 8)}`,
    transactionId: `earn_order_${order.id}`,
  });

  const visitCount = (customer.visitCount ?? 0) + 1;
  const totalSpent = roundMoney((customer.totalSpent ?? 0) + order.total);
  const last = customer.lastVisitAt
    ? new Date(customer.lastVisitAt).getTime()
    : null;
  const paidAt = new Date(order.paidAt ?? stamp).getTime();
  let avgDaysBetweenVisits = customer.avgDaysBetweenVisits;
  if (last && visitCount > 1) {
    const gap = (paidAt - last) / 86_400_000;
    avgDaysBetweenVisits = roundMoney(
      ((avgDaysBetweenVisits ?? gap) * (visitCount - 2) + gap) /
        Math.max(1, visitCount - 1),
    );
  }

  const draft: Customer = {
    ...customer,
    visitCount,
    totalSpent,
    lastVisitAt: order.paidAt ?? stamp,
    lastBranchId: order.branchId,
    avgDaysBetweenVisits,
    points: (customer.points ?? 0) + earn,
  };
  const valueScore = computeValueScore(draft);
  const tier = deriveTier(draft.points, valueScore);
  const segments = computeSegments({ ...draft, valueScore, tier });

  const batch = writeBatch(getDb());
  batch.update(custRef, {
    visitCount,
    totalSpent,
    lastVisitAt: order.paidAt ?? stamp,
    lastBranchId: order.branchId,
    avgDaysBetweenVisits: avgDaysBetweenVisits ?? null,
    valueScore,
    tier,
    segments,
    updatedAt: stamp,
  });
  await batch.commit();

  await appendHistory({
    restaurantId,
    customerId: order.customerId,
    branchId: order.branchId,
    type: "order",
    title: `Pedido ${order.tableName ?? "#" + order.id.slice(0, 6)}`,
    description: `${order.items.length} líneas · ${order.total} ${order.currency}`,
    referenceType: "order",
    referenceId: order.id,
    amount: order.total,
    pointsDelta: earn,
    actorUid,
    entryId: histId,
  });
}

export function subscribePaidOrdersWithCustomer(
  restaurantId: string,
  onOrder: (order: Order) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    where("status", "==", "paid"),
  );
  return onSnapshot(
    q,
    (snap) => {
      for (const d of snap.docs) {
        const order = { id: d.id, ...d.data() } as Order;
        if (order.customerId) onOrder(order);
      }
    },
    (err) => onError?.(err),
  );
}
