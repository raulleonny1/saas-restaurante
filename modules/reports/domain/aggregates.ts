import {
  dayKey,
  formatDayLabel,
  inRange,
  previousRange,
  type DateRange,
} from "@/modules/reports/domain/period";
import type { Product } from "@/types/catalog";
import type { Ingredient } from "@/types/catalog";
import type { Customer } from "@/types/customers";
import type { Employee, EmployeeShift } from "@/types/employees";
import type { InventoryLevel, WasteEntry } from "@/types/inventory";
import type { Order } from "@/types/orders";

export interface SeriesPoint {
  key: string;
  label: string;
  value: number;
  secondary?: number;
}

export interface NamedValue {
  name: string;
  value: number;
  meta?: string;
}

export interface SalesReportData {
  revenue: number;
  orders: number;
  avgTicket: number;
  tips: number;
  discounts: number;
  guests: number;
  byDay: SeriesPoint[];
  byChannel: NamedValue[];
  byPaymentProxy: NamedValue[];
}

export interface ProfitReportData {
  revenue: number;
  estimatedCost: number;
  wasteCost: number;
  grossProfit: number;
  margin: number;
  byDay: SeriesPoint[];
}

export interface ProductsReportData {
  topByRevenue: NamedValue[];
  topByQty: NamedValue[];
  categoryMix: NamedValue[];
}

export interface CustomersReportData {
  active: number;
  newInPeriod: number;
  returning: number;
  avgLtv: number;
  topSpenders: NamedValue[];
  byTier: NamedValue[];
}

export interface InventoryReportData {
  skus: number;
  lowStock: number;
  stockValue: number;
  wasteCost: number;
  lowStockItems: NamedValue[];
  wasteByReason: NamedValue[];
}

export interface EmployeesReportData {
  active: number;
  shiftHours: number;
  bySales: NamedValue[];
  byHours: NamedValue[];
}

export interface PeakHoursReportData {
  byHour: SeriesPoint[];
  byWeekday: NamedValue[];
  peakHourLabel: string;
}

export interface ComparativesReportData {
  current: { revenue: number; orders: number; avgTicket: number; profit: number };
  previous: { revenue: number; orders: number; avgTicket: number; profit: number };
  deltas: { revenue: number; orders: number; avgTicket: number; profit: number };
  series: SeriesPoint[];
}

function paidOrders(orders: Order[], range: DateRange): Order[] {
  return orders.filter(
    (o) =>
      !o.deletedAt &&
      o.status === "paid" &&
      inRange(o.paidAt ?? o.updatedAt, range),
  );
}

function productCostMap(
  products: Product[],
  ingredients: Ingredient[],
): Map<string, number> {
  const ingCost = new Map(ingredients.map((i) => [i.id, i.costPerUnit]));
  const map = new Map<string, number>();
  for (const p of products) {
    if (typeof p.cost === "number") {
      map.set(p.id, p.cost);
      continue;
    }
    let recipeCost = 0;
    for (const r of p.recipe ?? []) {
      recipeCost += (ingCost.get(r.ingredientId) ?? 0) * r.quantity;
    }
    map.set(p.id, recipeCost || p.price * 0.35);
  }
  return map;
}

function orderCost(order: Order, costs: Map<string, number>): number {
  return order.items.reduce(
    (sum, item) => sum + (costs.get(item.productId) ?? item.unitPrice * 0.35) * item.quantity,
    0,
  );
}

export function buildSalesReport(
  orders: Order[],
  range: DateRange,
): SalesReportData {
  const list = paidOrders(orders, range);
  const revenue = list.reduce((s, o) => s + o.total, 0);
  const tips = list.reduce((s, o) => s + (o.tipAmount ?? 0), 0);
  const discounts = list.reduce(
    (s, o) => s + (o.discountAmount ?? 0) + (o.subtotal * (o.discountPercent ?? 0)) / 100,
    0,
  );
  const guests = list.reduce((s, o) => s + (o.guestCount ?? 1), 0);

  const dayMap = new Map<string, number>();
  const channelMap = new Map<string, number>();
  for (const o of list) {
    const key = dayKey(o.paidAt ?? o.updatedAt);
    dayMap.set(key, (dayMap.get(key) ?? 0) + o.total);
    channelMap.set(o.channel, (channelMap.get(o.channel) ?? 0) + o.total);
  }

  // Fill missing days
  const byDay: SeriesPoint[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const key = dayKey(cursor.toISOString());
    byDay.push({
      key,
      label: formatDayLabel(key),
      value: dayMap.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    revenue,
    orders: list.length,
    avgTicket: list.length ? revenue / list.length : 0,
    tips,
    discounts,
    guests,
    byDay,
    byChannel: [...channelMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    byPaymentProxy: [],
  };
}

export function buildProfitReport(
  orders: Order[],
  products: Product[],
  ingredients: Ingredient[],
  waste: WasteEntry[],
  range: DateRange,
): ProfitReportData {
  const list = paidOrders(orders, range);
  const costs = productCostMap(products, ingredients);
  const revenue = list.reduce((s, o) => s + o.total, 0);
  const estimatedCost = list.reduce((s, o) => s + orderCost(o, costs), 0);
  const wasteCost = waste
    .filter((w) => inRange(w.createdAt, range))
    .reduce((s, w) => s + (w.costImpact ?? 0), 0);
  const grossProfit = revenue - estimatedCost - wasteCost;

  const dayRev = new Map<string, number>();
  const dayCost = new Map<string, number>();
  for (const o of list) {
    const key = dayKey(o.paidAt ?? o.updatedAt);
    dayRev.set(key, (dayRev.get(key) ?? 0) + o.total);
    dayCost.set(key, (dayCost.get(key) ?? 0) + orderCost(o, costs));
  }

  const byDay: SeriesPoint[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const key = dayKey(cursor.toISOString());
    const rev = dayRev.get(key) ?? 0;
    const cost = dayCost.get(key) ?? 0;
    byDay.push({
      key,
      label: formatDayLabel(key),
      value: rev - cost,
      secondary: rev,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    revenue,
    estimatedCost,
    wasteCost,
    grossProfit,
    margin: revenue > 0 ? grossProfit / revenue : 0,
    byDay,
  };
}

export function buildProductsReport(
  orders: Order[],
  products: Product[],
  range: DateRange,
  categoryNames?: Map<string, string>,
): ProductsReportData {
  const list = paidOrders(orders, range);
  const rev = new Map<string, { name: string; revenue: number; qty: number; cat: string }>();
  const catMap = new Map(products.map((p) => [p.id, p.categoryId]));
  const nameMap = new Map(products.map((p) => [p.id, p.name]));

  for (const o of list) {
    for (const item of o.items) {
      const id = item.productId;
      const catId = catMap.get(id) ?? "otros";
      const cur = rev.get(id) ?? {
        name: item.name || nameMap.get(id) || id,
        revenue: 0,
        qty: 0,
        cat: categoryNames?.get(catId) ?? catId,
      };
      cur.revenue += item.unitPrice * item.quantity;
      cur.qty += item.quantity;
      rev.set(id, cur);
    }
  }

  const rows = [...rev.values()];
  const categoryMix = new Map<string, number>();
  for (const r of rows) {
    categoryMix.set(r.cat, (categoryMix.get(r.cat) ?? 0) + r.revenue);
  }

  return {
    topByRevenue: rows
      .map((r) => ({ name: r.name, value: r.revenue }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    topByQty: rows
      .map((r) => ({ name: r.name, value: r.qty }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    categoryMix: [...categoryMix.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export function buildCustomersReport(
  customers: Customer[],
  orders: Order[],
  range: DateRange,
): CustomersReportData {
  const list = paidOrders(orders, range);
  const buyerIds = new Set(
    list.map((o) => o.customerId).filter(Boolean) as string[],
  );
  const newInPeriod = customers.filter(
    (c) => !c.deletedAt && inRange(c.createdAt, range),
  ).length;
  const returning = [...buyerIds].filter((id) => {
    const c = customers.find((x) => x.id === id);
    return c && (c.visitCount ?? 0) > 1;
  }).length;

  const spend = new Map<string, number>();
  for (const o of list) {
    if (!o.customerId) continue;
    spend.set(o.customerId, (spend.get(o.customerId) ?? 0) + o.total);
  }

  const tierMap = new Map<string, number>();
  for (const c of customers.filter((x) => !x.deletedAt)) {
    const t = c.tier ?? "standard";
    tierMap.set(t, (tierMap.get(t) ?? 0) + 1);
  }

  const active = customers.filter((c) => !c.deletedAt);
  const avgLtv = active.length
    ? active.reduce((s, c) => s + (c.totalSpent ?? 0), 0) / active.length
    : 0;

  return {
    active: active.length,
    newInPeriod,
    returning,
    avgLtv,
    topSpenders: [...spend.entries()]
      .map(([id, value]) => ({
        name: customers.find((c) => c.id === id)?.name ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    byTier: [...tierMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export function buildInventoryReport(
  levels: InventoryLevel[],
  ingredients: Ingredient[],
  waste: WasteEntry[],
  range: DateRange,
): InventoryReportData {
  const names = new Map(ingredients.map((i) => [i.id, i.name]));
  const costs = new Map(ingredients.map((i) => [i.id, i.costPerUnit]));
  let stockValue = 0;
  let lowStock = 0;
  const lowStockItems: NamedValue[] = [];

  for (const l of levels) {
    const unitCost = costs.get(l.ingredientId) ?? 0;
    stockValue += l.quantity * unitCost;
    if (l.quantity <= l.minStock) {
      lowStock += 1;
      lowStockItems.push({
        name: names.get(l.ingredientId) ?? l.ingredientId,
        value: l.quantity,
        meta: `mín ${l.minStock}`,
      });
    }
  }

  const periodWaste = waste.filter((w) => inRange(w.createdAt, range));
  const reasonMap = new Map<string, number>();
  for (const w of periodWaste) {
    reasonMap.set(w.reason, (reasonMap.get(w.reason) ?? 0) + w.costImpact);
  }

  return {
    skus: levels.length,
    lowStock,
    stockValue,
    wasteCost: periodWaste.reduce((s, w) => s + w.costImpact, 0),
    lowStockItems: lowStockItems.sort((a, b) => a.value - b.value).slice(0, 12),
    wasteByReason: [...reasonMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export function buildEmployeesReport(
  employees: Employee[],
  shifts: EmployeeShift[],
  orders: Order[],
  range: DateRange,
): EmployeesReportData {
  const active = employees.filter((e) => !e.deletedAt && e.status === "active");
  const periodShifts = shifts.filter(
    (s) => inRange(s.startsAt, range) || inRange(s.endsAt, range),
  );

  const hours = new Map<string, number>();
  for (const s of periodShifts) {
    const h =
      (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) /
      3_600_000;
    hours.set(s.employeeId, (hours.get(s.employeeId) ?? 0) + Math.max(0, h));
  }

  const sales = new Map<string, number>();
  for (const o of paidOrders(orders, range)) {
    const id = o.servedBy || o.createdBy;
    if (!id) continue;
    // Match by uid or employee id
    const emp =
      employees.find((e) => e.uid === id || e.id === id) ?? null;
    const key = emp?.id ?? id;
    sales.set(key, (sales.get(key) ?? 0) + o.total);
  }

  const nameOf = (id: string) =>
    employees.find((e) => e.id === id || e.uid === id)?.name ?? id;

  return {
    active: active.length,
    shiftHours: [...hours.values()].reduce((s, h) => s + h, 0),
    bySales: [...sales.entries()]
      .map(([id, value]) => ({ name: nameOf(id), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    byHours: [...hours.entries()]
      .map(([id, value]) => ({
        name: nameOf(id),
        value: Math.round(value * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
  };
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function buildPeakHoursReport(
  orders: Order[],
  range: DateRange,
): PeakHoursReportData {
  const list = paidOrders(orders, range);
  const hourMap = new Array(24).fill(0) as number[];
  const weekdayMap = new Array(7).fill(0) as number[];

  for (const o of list) {
    const d = new Date(o.paidAt ?? o.updatedAt);
    hourMap[d.getHours()] += o.total;
    weekdayMap[d.getDay()] += o.total;
  }

  const byHour: SeriesPoint[] = hourMap.map((value, hour) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
    value,
  }));

  let peak = 0;
  for (let i = 1; i < 24; i++) {
    if (hourMap[i] > hourMap[peak]) peak = i;
  }

  return {
    byHour,
    byWeekday: weekdayMap.map((value, i) => ({
      name: WEEKDAYS[i],
      value,
    })),
    peakHourLabel: `${String(peak).padStart(2, "0")}:00`,
  };
}

export function buildComparativesReport(
  orders: Order[],
  products: Product[],
  ingredients: Ingredient[],
  waste: WasteEntry[],
  range: DateRange,
): ComparativesReportData {
  const prev = previousRange(range);
  const curSales = buildSalesReport(orders, range);
  const prevSales = buildSalesReport(orders, prev);
  const curProfit = buildProfitReport(orders, products, ingredients, waste, range);
  const prevProfit = buildProfitReport(orders, products, ingredients, waste, prev);

  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 1 : 0) : (a - b) / b);

  // Align series: current day values vs previous day-of-period
  const series: SeriesPoint[] = curSales.byDay.map((p, i) => ({
    key: p.key,
    label: p.label,
    value: p.value,
    secondary: prevSales.byDay[i]?.value ?? 0,
  }));

  return {
    current: {
      revenue: curSales.revenue,
      orders: curSales.orders,
      avgTicket: curSales.avgTicket,
      profit: curProfit.grossProfit,
    },
    previous: {
      revenue: prevSales.revenue,
      orders: prevSales.orders,
      avgTicket: prevSales.avgTicket,
      profit: prevProfit.grossProfit,
    },
    deltas: {
      revenue: delta(curSales.revenue, prevSales.revenue),
      orders: delta(curSales.orders, prevSales.orders),
      avgTicket: delta(curSales.avgTicket, prevSales.avgTicket),
      profit: delta(curProfit.grossProfit, prevProfit.grossProfit),
    },
    series,
  };
}
