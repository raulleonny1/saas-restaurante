"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { startOfToday } from "@/lib/format";
import type { AiInsight } from "@/types/ai";
import type { Customer } from "@/types/customers";
import {
  EMPTY_DASHBOARD_METRICS,
  type DashboardAlert,
  type DashboardMetrics,
  type HourlySalesPoint,
} from "@/types/dashboard";
import type { InventoryLevel } from "@/types/inventory";
import type { Order, Table } from "@/types/orders";
import type { Reservation } from "@/types/reservations";
import type { Branch } from "@/types/restaurant";
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";

function buildHourlySales(paidToday: Order[]): HourlySalesPoint[] {
  return Array.from({ length: 14 }, (_, i) => {
    const hour = 8 + i;
    const inHour = paidToday.filter(
      (o) => o.paidAt && new Date(o.paidAt).getHours() === hour,
    );
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      amount: inHour.reduce((s, o) => s + (o.total || 0), 0),
      orders: inHour.length,
    };
  });
}

function buildAlerts(
  lowStock: InventoryLevel[],
  insights: AiInsight[],
  openOrders: number,
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const item of lowStock.slice(0, 5)) {
    alerts.push({
      id: `stock-${item.id}`,
      type: "inventory",
      tone: item.quantity <= 0 ? "danger" : "warning",
      title: "Stock bajo",
      description: `${item.ingredientId}: ${item.quantity} ${item.unit} (mín. ${item.minStock})`,
    });
  }

  for (const insight of insights.slice(0, 3)) {
    alerts.push({
      id: `ai-${insight.id}`,
      type: "ai",
      tone: "accent",
      title: insight.title,
      description: insight.summary,
    });
  }

  if (openOrders > 8) {
    alerts.push({
      id: "ops-load",
      type: "ops",
      tone: "warning",
      title: "Alta carga operativa",
      description: `Hay ${openOrders} pedidos abiertos en este momento.`,
    });
  }

  return alerts;
}

function computeMetrics(input: {
  orders: Order[];
  tables: Table[];
  levels: InventoryLevel[];
  customers: Customer[];
  reservations: Reservation[];
  insights: AiInsight[];
  branchId: string | null;
}): DashboardMetrics {
  const start = startOfToday().getTime();
  const end = start + 24 * 60 * 60 * 1000;

  const inBranch = <T extends { branchId?: string | null }>(items: T[]) =>
    input.branchId
      ? items.filter((i) => !i.branchId || i.branchId === input.branchId)
      : items;

  const orders = inBranch(input.orders);
  const tables = inBranch(input.tables);
  const levels = inBranch(input.levels);
  const reservations = inBranch(input.reservations);
  const insights = input.insights.filter(
    (i) =>
      i.status === "new" &&
      (!input.branchId || !i.branchId || i.branchId === input.branchId),
  );

  const paidToday = orders.filter(
    (o) =>
      o.status === "paid" &&
      o.paidAt &&
      new Date(o.paidAt).getTime() >= start &&
      new Date(o.paidAt).getTime() < end,
  );

  const openOrders = orders.filter((o) =>
    ["open", "sent", "preparing", "ready"].includes(o.status),
  ).length;

  const openTables = tables.filter((t) => t.status === "occupied").length;

  const lowStockItems = levels.filter((l) => l.quantity <= l.minStock);
  const revenueToday = paidToday.reduce((s, o) => s + (o.total || 0), 0);
  const ordersToday = paidToday.length;

  const customersToday = input.customers.filter(
    (c) =>
      c.lastVisitAt &&
      new Date(c.lastVisitAt).getTime() >= start &&
      (!input.branchId || !c.lastBranchId || c.lastBranchId === input.branchId),
  ).length;

  const reservationsToday = reservations.filter((r) => {
    const t = new Date(r.startsAt).getTime();
    return t >= start && t < end && !["cancelled", "no_show"].includes(r.status);
  }).length;

  return {
    revenueToday,
    ordersToday,
    averageTicket: ordersToday ? revenueToday / ordersToday : 0,
    openTables,
    openOrders,
    customersToday,
    reservationsToday,
    lowStockCount: lowStockItems.length,
    hourlySales: buildHourlySales(paidToday),
    lowStockItems,
    aiInsights: insights,
    alerts: buildAlerts(lowStockItems, insights, openOrders),
  };
}

export function listBranches(
  restaurantId: string,
  cb: (branches: Branch[]) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    cb([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "branches"),
    (snap) => {
      cb(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch).filter(
          (b) => b.status !== "archived",
        ),
      );
    },
    () => cb([]),
  );
}

/**
 * Realtime dashboard aggregator for one restaurant (optional branch filter).
 */
export function subscribeDashboard(
  restaurantId: string,
  branchId: string | null,
  cb: (metrics: DashboardMetrics) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    cb(EMPTY_DASHBOARD_METRICS);
    return () => undefined;
  }

  const db = getDb();
  let orders: Order[] = [];
  let tables: Table[] = [];
  let levels: InventoryLevel[] = [];
  let customers: Customer[] = [];
  let reservations: Reservation[] = [];
  let insights: AiInsight[] = [];

  const emit = () => {
    cb(
      computeMetrics({
        orders,
        tables,
        levels,
        customers,
        reservations,
        insights,
        branchId,
      }),
    );
  };

  const unsubs: Unsubscribe[] = [
    onSnapshot(
      collection(db, "restaurants", restaurantId, "orders"),
      (snap) => {
        orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
        emit();
      },
      () => {
        orders = [];
        emit();
      },
    ),
    onSnapshot(
      collection(db, "restaurants", restaurantId, "tables"),
      (snap) => {
        tables = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Table);
        emit();
      },
      () => {
        tables = [];
        emit();
      },
    ),
    onSnapshot(
      collection(db, "restaurants", restaurantId, "inventoryLevels"),
      (snap) => {
        levels = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryLevel);
        emit();
      },
      () => {
        levels = [];
        emit();
      },
    ),
    onSnapshot(
      collection(db, "restaurants", restaurantId, "customers"),
      (snap) => {
        customers = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
        emit();
      },
      () => {
        customers = [];
        emit();
      },
    ),
    onSnapshot(
      collection(db, "restaurants", restaurantId, "reservations"),
      (snap) => {
        reservations = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Reservation,
        );
        emit();
      },
      () => {
        reservations = [];
        emit();
      },
    ),
    onSnapshot(
      collection(db, "restaurants", restaurantId, "aiInsights"),
      (snap) => {
        insights = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AiInsight)
          .filter((i) => i.status === "new")
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        emit();
      },
      () => {
        insights = [];
        emit();
      },
    ),
  ];

  emit();

  return () => unsubs.forEach((u) => u());
}
