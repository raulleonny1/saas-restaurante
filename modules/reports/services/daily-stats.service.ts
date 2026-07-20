"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { dayKey } from "@/modules/reports/domain/period";
import type { Order, PaymentMethod } from "@/types/orders";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export type DailyStatsDoc = {
  id: string;
  restaurantId: string;
  branchId: string;
  /** yyyy-mm-dd */
  day: string;
  revenue: number;
  orders: number;
  tickets: number;
  tips: number;
  guests: number;
  byMethod: Record<string, number>;
  topProducts: Record<string, { name: string; qty: number; revenue: number }>;
  updatedAt: string;
};

export function dailyStatsDocId(branchId: string, day: string) {
  return `${branchId}_${day}`;
}

/**
 * Incremento atómico al cobrar (Fase 2).
 * Doc: restaurants/{id}/dailyStats/{branchId_yyyy-mm-dd}
 */
export async function recordPaymentInDailyStats(input: {
  restaurantId: string;
  order: Order;
  method: PaymentMethod;
  amount: number;
  tipAmount?: number;
}): Promise<void> {
  const { restaurantId, order, method, amount } = input;
  const tip = input.tipAmount ?? 0;
  const day = dayKey(order.paidAt ?? new Date().toISOString());
  const id = dailyStatsDocId(order.branchId, day);
  const ref = doc(getDb(), "restaurants", restaurantId, "dailyStats", id);
  const stamp = new Date().toISOString();

  const existing = await getDoc(ref);
  const batch = writeBatch(getDb());

  if (!existing.exists()) {
    const topProducts: DailyStatsDoc["topProducts"] = {};
    for (const item of order.items) {
      const prev = topProducts[item.productId];
      topProducts[item.productId] = {
        name: item.name,
        qty: (prev?.qty ?? 0) + item.quantity,
        revenue: (prev?.revenue ?? 0) + item.unitPrice * item.quantity,
      };
    }
    const fullyPaid = order.status === "paid";
    batch.set(
      ref,
      stripUndefined({
        id,
        restaurantId,
        branchId: order.branchId,
        day,
        revenue: amount,
        orders: fullyPaid ? 1 : 0,
        tickets: 1,
        tips: tip,
        guests: fullyPaid ? order.guestCount || 1 : 0,
        byMethod: { [method]: amount },
        topProducts,
        updatedAt: stamp,
        createdAt: stamp,
      }),
    );
  } else {
    const data = existing.data() as DailyStatsDoc;
    const byMethod = { ...(data.byMethod ?? {}) };
    byMethod[method] = (byMethod[method] ?? 0) + amount;
    const topProducts = { ...(data.topProducts ?? {}) };
    if (order.status === "paid") {
      for (const item of order.items) {
        const prev = topProducts[item.productId];
        topProducts[item.productId] = {
          name: item.name,
          qty: (prev?.qty ?? 0) + item.quantity,
          revenue: (prev?.revenue ?? 0) + item.unitPrice * item.quantity,
        };
      }
    }
    batch.update(ref, {
      revenue: increment(amount),
      tickets: increment(1),
      tips: increment(tip),
      ...(order.status === "paid"
        ? {
            orders: increment(1),
            guests: increment(order.guestCount || 1),
          }
        : {}),
      byMethod,
      topProducts,
      updatedAt: stamp,
    });
  }

  await batch.commit();
}

export function subscribeDailyStats(
  restaurantId: string,
  onData: (rows: DailyStatsDoc[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "dailyStats"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyStatsDoc),
      );
    },
    (err) => onError?.(err),
  );
}

export async function fetchDailyStatsInRange(
  restaurantId: string,
  fromDay: string,
  toDay: string,
): Promise<DailyStatsDoc[]> {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "dailyStats"),
    where("day", ">=", fromDay),
    where("day", "<=", toDay),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyStatsDoc);
}

/** Fusiona dailyStats en SalesReportData; si vacío, el caller usa live orders. */
export function salesFromDailyStats(
  rows: DailyStatsDoc[],
  fillDays: { key: string; label: string }[],
): {
  revenue: number;
  orders: number;
  avgTicket: number;
  tips: number;
  discounts: number;
  guests: number;
  byDay: { key: string; label: string; value: number }[];
  byChannel: { name: string; value: number }[];
  byPaymentProxy: { name: string; value: number }[];
} | null {
  if (!rows.length) return null;
  const dayMap = new Map<string, number>();
  const methodMap = new Map<string, number>();
  let revenue = 0;
  let orders = 0;
  let tips = 0;
  let guests = 0;
  for (const r of rows) {
    revenue += r.revenue || 0;
    orders += r.orders || 0;
    tips += r.tips || 0;
    guests += r.guests || 0;
    dayMap.set(r.day, (dayMap.get(r.day) ?? 0) + (r.revenue || 0));
    for (const [m, v] of Object.entries(r.byMethod ?? {})) {
      methodMap.set(m, (methodMap.get(m) ?? 0) + v);
    }
  }
  return {
    revenue,
    orders,
    avgTicket: orders ? revenue / orders : 0,
    tips,
    discounts: 0,
    guests,
    byDay: fillDays.map((d) => ({
      ...d,
      value: dayMap.get(d.key) ?? 0,
    })),
    byChannel: [],
    byPaymentProxy: [...methodMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}
