"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { CashSession } from "@/types/cash-session";
import type { Payment } from "@/types/orders";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function subscribeOpenCashSession(
  restaurantId: string,
  branchId: string,
  onData: (session: CashSession | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "cashSessions"),
    where("branchId", "==", branchId),
    where("status", "==", "open"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as CashSession,
      );
      rows.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      onData(rows[0] ?? null);
    },
    (err) => onError?.(err),
  );
}

export function subscribeCashSessions(
  restaurantId: string,
  branchId: string,
  onData: (rows: CashSession[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "cashSessions"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CashSession)
          .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
          .slice(0, 40),
      );
    },
    (err) => onError?.(err),
  );
}

export async function openCashSession(input: {
  restaurantId: string;
  branchId: string;
  uid: string;
  name?: string;
  openingFloat: number;
  currency: string;
}): Promise<CashSession> {
  const stamp = nowIso();
  // Evitar doble apertura
  const existing = await getDocs(
    query(
      collection(getDb(), "restaurants", input.restaurantId, "cashSessions"),
      where("branchId", "==", input.branchId),
      where("status", "==", "open"),
    ),
  );
  if (!existing.empty) {
    throw new Error("Ya hay una sesión de caja abierta en esta sucursal");
  }

  const id = newId();
  const row: CashSession = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    status: "open",
    openedAt: stamp,
    openedBy: input.uid,
    openedByName: input.name,
    openingFloat: input.openingFloat,
    currency: input.currency as CashSession["currency"],
    createdAt: stamp,
    updatedAt: stamp,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "cashSessions", id),
    stripUndefined({ ...row }),
  );
  await batch.commit();
  return row;
}

export function computeExpectedCash(
  openingFloat: number,
  payments: Payment[],
): number {
  let cash = openingFloat;
  for (const p of payments) {
    if (p.status !== "completed" && p.status !== "refunded") continue;
    if (p.method !== "cash") continue;
    if (p.refundOfPaymentId || p.status === "refunded") {
      cash -= p.amount;
      continue;
    }
    cash += p.amount;
    if (p.changeGiven) cash -= p.changeGiven;
  }
  return Math.round(cash * 100) / 100;
}

export async function closeCashSession(input: {
  restaurantId: string;
  session: CashSession;
  countedCash: number;
  payments: Payment[];
  uid: string;
  name?: string;
  notes?: string;
}): Promise<CashSession> {
  const stamp = nowIso();
  const sessionPayments = input.payments.filter(
    (p) =>
      (p.cashSessionId === input.session.id ||
        (p.paidAt && p.paidAt >= input.session.openedAt)) &&
      p.branchId === input.session.branchId,
  );

  const totals = {
    cashSales: 0,
    cardSales: 0,
    stripeSales: 0,
    sumupSales: 0,
    otherSales: 0,
    tips: 0,
    refunds: 0,
    tickets: 0,
  };
  const orderIds = new Set<string>();
  for (const p of sessionPayments) {
    if (p.refundOfPaymentId || p.status === "refunded") {
      totals.refunds += p.amount;
      continue;
    }
    if (p.status !== "completed") continue;
    orderIds.add(p.orderId);
    totals.tips += p.tipAmount || 0;
    switch (p.method) {
      case "cash":
        totals.cashSales += p.amount;
        break;
      case "card":
        totals.cardSales += p.amount;
        break;
      case "stripe":
        totals.stripeSales += p.amount;
        break;
      case "sumup":
        totals.sumupSales += p.amount;
        break;
      default:
        totals.otherSales += p.amount;
    }
  }
  totals.tickets = orderIds.size;

  const expectedCash = computeExpectedCash(
    input.session.openingFloat,
    sessionPayments,
  );
  const difference =
    Math.round((input.countedCash - expectedCash) * 100) / 100;

  // Z number: count closed + 1
  let zNumber = 1;
  try {
    const closed = await getDocs(
      query(
        collection(getDb(), "restaurants", input.restaurantId, "cashSessions"),
        where("branchId", "==", input.session.branchId),
        where("status", "==", "closed"),
      ),
    );
    zNumber = closed.size + 1;
  } catch {
    zNumber = Date.now() % 10000;
  }

  const next: CashSession = {
    ...input.session,
    status: "closed",
    closedAt: stamp,
    closedBy: input.uid,
    closedByName: input.name,
    countedCash: input.countedCash,
    expectedCash,
    difference,
    totals,
    notes: input.notes,
    zNumber,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "cashSessions",
      input.session.id,
    ),
    stripUndefined({ ...next }),
  );
  await batch.commit();
  return next;
}
