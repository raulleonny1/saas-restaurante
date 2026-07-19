"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { balanceDue, recalculateOrder, roundMoney } from "@/modules/pos/domain/totals";
import type {
  Order,
  Payment,
  PaymentChargedFrom,
  PaymentMethod,
  Table,
} from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";
import { newId } from "./orders.service";

function nowIso() {
  return new Date().toISOString();
}

export function subscribePaymentsForOrder(
  restaurantId: string,
  orderId: string,
  onData: (payments: Payment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "payments"),
    where("orderId", "==", orderId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment));
    },
    (err) => onError?.(err),
  );
}

/** Pagos de la sucursal (mesero/caja filtran el día en cliente). */
export function subscribePaymentsForBranch(
  restaurantId: string,
  branchId: string,
  onData: (payments: Payment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "payments"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Payment)
          .sort((a, b) =>
            (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt),
          ),
      );
    },
    (err) => onError?.(err),
  );
}

export interface ChargeInput {
  restaurantId: string;
  order: Order;
  tables: Table[];
  method: PaymentMethod;
  amount: number;
  tipAmount?: number;
  splitSeat?: number;
  /** Efectivo recibido del cliente (solo método cash). */
  amountTendered?: number;
  uid: string;
  processedByName?: string;
  chargedFrom?: PaymentChargedFrom;
  taxPercent: number;
}

export async function chargeOrder(input: ChargeInput): Promise<{
  order: Order;
  payment: Payment;
}> {
  const {
    restaurantId,
    order,
    tables,
    method,
    amount,
    tipAmount = 0,
    splitSeat,
    amountTendered,
    uid,
    processedByName,
    chargedFrom,
    taxPercent,
  } = input;

  const due = balanceDue(order);
  const payAmount = roundMoney(Math.min(amount, due || amount));
  if (payAmount <= 0) throw new Error("Nada que cobrar");

  const tip = roundMoney(tipAmount);
  const collectTotal = roundMoney(payAmount + tip);
  const tendered =
    method === "cash" && amountTendered != null && amountTendered > 0
      ? roundMoney(amountTendered)
      : undefined;
  if (tendered != null && tendered + 0.001 < collectTotal) {
    throw new Error("El efectivo entregado no cubre el cobro + propina");
  }
  const changeGiven =
    tendered != null
      ? roundMoney(Math.max(0, tendered - collectTotal))
      : undefined;

  const stamp = nowIso();
  const paymentId = newId("pay");
  const payment: Payment = {
    id: paymentId,
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    method,
    status: "completed",
    amount: payAmount,
    currency: order.currency,
    tipAmount,
    processedBy: uid,
    paidAt: stamp,
    splitSeat,
    ...(processedByName ? { processedByName } : {}),
    ...(chargedFrom ? { chargedFrom } : {}),
    ...(tendered != null ? { amountTendered: tendered } : {}),
    ...(changeGiven != null ? { changeGiven } : {}),
    createdAt: stamp,
    updatedAt: stamp,
  };

  const amountPaid = roundMoney((order.amountPaid ?? 0) + payAmount);
  const totals = recalculateOrder(order, taxPercent);
  const fullyPaid = amountPaid + 0.001 >= totals.total;
  const next: Order = {
    ...order,
    ...totals,
    amountPaid,
    tipAmount: roundMoney(order.tipAmount + tipAmount),
    status: fullyPaid ? "paid" : order.status,
    paidAt: fullyPaid ? stamp : order.paidAt,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", restaurantId, "payments", paymentId),
    stripUndefined({ ...payment }),
  );
  batch.set(
    doc(getDb(), "restaurants", restaurantId, "orders", order.id),
    stripUndefined({ ...next }),
  );

  if (fullyPaid) {
    const related = tables.filter(
      (t) =>
        t.id === order.tableId ||
        (order.mergedTableIds ?? []).includes(t.id) ||
        t.currentOrderId === order.id,
    );
    for (const t of related) {
      batch.update(doc(getDb(), "restaurants", restaurantId, "tables", t.id), {
        status: "dirty",
        currentOrderId: null,
        mergedWith: [],
        updatedAt: stamp,
      });
    }
  }

  await batch.commit();
  return { order: next, payment };
}

export async function refundPayment(input: {
  restaurantId: string;
  order: Order;
  payment: Payment;
  amount: number;
  uid: string;
  taxPercent: number;
  reopenTable?: Table | null;
}): Promise<{ order: Order; refund: Payment }> {
  const { restaurantId, order, payment, uid, taxPercent, reopenTable } = input;
  const amount = roundMoney(
    Math.min(input.amount, payment.amount - (payment.refundAmount ?? 0)),
  );
  if (amount <= 0) throw new Error("Importe de reembolso inválido");

  const stamp = nowIso();
  const refundId = newId("pay");
  const refund: Payment = {
    id: refundId,
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    method: payment.method,
    status: "refunded",
    amount: -amount,
    currency: order.currency,
    tipAmount: 0,
    processedBy: uid,
    paidAt: stamp,
    refundOfPaymentId: payment.id,
    refundAmount: amount,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const amountPaid = roundMoney(Math.max(0, (order.amountPaid ?? 0) - amount));
  const totals = recalculateOrder(order, taxPercent);
  const next: Order = {
    ...order,
    ...totals,
    amountPaid,
    status: amountPaid <= 0.001 ? "cancelled" : order.status,
    refundedAt: stamp,
    cancelledAt: amountPaid <= 0.001 ? stamp : order.cancelledAt,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", restaurantId, "payments", refundId),
    refund,
  );
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "payments", payment.id),
    {
      status: "refunded",
      refundAmount: roundMoney((payment.refundAmount ?? 0) + amount),
      updatedAt: stamp,
    },
  );
  batch.set(
    doc(getDb(), "restaurants", restaurantId, "orders", order.id),
    stripUndefined({ ...next }),
  );

  if (reopenTable && amountPaid <= 0.001) {
    batch.update(
      doc(getDb(), "restaurants", restaurantId, "tables", reopenTable.id),
      {
        status: "available",
        currentOrderId: null,
        updatedAt: stamp,
      },
    );
  }

  await batch.commit();
  return { order: next, refund };
}
