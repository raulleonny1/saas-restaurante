import type { AiInsight } from "@/types/ai";
import type { DashboardAlert, DashboardMetrics, HourlySalesPoint } from "@/types/dashboard";
import type { Branch } from "@/types/restaurant";

/** Demo tenant used when RestaurantProvider has no live restaurant name. */
export const MOCK_RESTAURANT = {
  id: "rest_demo",
  name: "Café Norte",
  currency: "EUR" as const,
};

export const MOCK_BRANCHES: Branch[] = [
  {
    id: "branch_centro",
    restaurantId: MOCK_RESTAURANT.id,
    name: "Centro",
    code: "CENTRO",
    isDefault: true,
    status: "active",
    timezone: "Europe/Madrid",
    currency: "EUR",
    address: "Calle Mayor 12, Madrid",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "branch_norte",
    restaurantId: MOCK_RESTAURANT.id,
    name: "Norte",
    code: "NORTE",
    isDefault: false,
    status: "active",
    timezone: "Europe/Madrid",
    currency: "EUR",
    address: "Av. de América 40, Madrid",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  },
];

function hourlySales(scale: number): HourlySalesPoint[] {
  const base = [
    40, 55, 90, 140, 210, 280, 320, 290, 260, 310, 380, 420, 390, 340, 300, 270,
  ];
  const startHour = 8;
  return base.map((amount, i) => ({
    hour: `${String(startHour + i).padStart(2, "0")}:00`,
    amount: Math.round(amount * scale),
    orders: Math.max(1, Math.round((amount * scale) / 18)),
  }));
}

const insightsCentro: AiInsight[] = [
  {
    id: "ins_promo_cafe",
    restaurantId: MOCK_RESTAURANT.id,
    branchId: "branch_centro",
    type: "promotion_suggestion",
    status: "new",
    title: "Promo café de media tarde",
    summary:
      "Entre 16:00–18:00 la demanda de espresso baja un 18%. Un 2º café al 50% podría recuperar ~90 €.",
    confidence: 0.82,
    data: { expectedUpliftEur: 90, windowStart: "16:00", windowEnd: "18:00" },
    generatedBy: "system",
    createdAt: "2026-07-19T08:00:00.000Z",
    updatedAt: "2026-07-19T08:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "ins_demand",
    restaurantId: MOCK_RESTAURANT.id,
    branchId: "branch_centro",
    type: "demand_forecast",
    status: "new",
    title: "Pico de demanda a las 13:00",
    summary: "El forecast de ventas prevé +22% vs media en la franja 12:30–14:00.",
    confidence: 0.91,
    generatedBy: "system",
    createdAt: "2026-07-19T07:30:00.000Z",
    updatedAt: "2026-07-19T07:30:00.000Z",
    deletedAt: null,
  },
];

const insightsNorte: AiInsight[] = [
  {
    id: "ins_stock_leche",
    restaurantId: MOCK_RESTAURANT.id,
    branchId: "branch_norte",
    type: "stock_prediction",
    status: "new",
    title: "Leche a punto de quiebre",
    summary: "Con el ritmo actual, la leche entera se agota mañana a las 11:00.",
    confidence: 0.88,
    generatedBy: "system",
    createdAt: "2026-07-19T09:00:00.000Z",
    updatedAt: "2026-07-19T09:00:00.000Z",
    deletedAt: null,
  },
];

function alertsFor(
  branchId: string | null,
  insights: AiInsight[],
  lowStockCount: number,
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (lowStockCount > 0) {
    alerts.push({
      id: "al_stock",
      type: "inventory",
      tone: "danger",
      title:
        lowStockCount === 1
          ? "1 ítem en stock bajo"
          : `${lowStockCount} ítems en stock bajo`,
      description:
        branchId === "branch_norte"
          ? "Leche entera y vasos 12oz por debajo del mínimo."
          : "Azúcar moreno y jarabe de vainilla bajo mínimo.",
    });
  }

  for (const insight of insights) {
    alerts.push({
      id: `al_${insight.id}`,
      type: "ai",
      tone: insight.type === "stock_prediction" ? "warning" : "accent",
      title: insight.title,
      description: insight.summary,
    });
  }

  if (!branchId) {
    alerts.push({
      id: "al_ops_tables",
      type: "ops",
      tone: "neutral",
      title: "6 mesas abiertas entre sucursales",
      description: "3 en Centro · 3 en Norte. Revisar tiempos de servicio en punta.",
    });
  }

  return alerts;
}

function metricsForBranch(branchId: string | null): DashboardMetrics {
  const isAll = !branchId;
  const isNorte = branchId === "branch_norte";
  const scale = isAll ? 1.85 : isNorte ? 0.78 : 1;

  const revenueToday = Math.round(1240 * scale);
  const ordersToday = Math.round(48 * scale);
  const openTables = isAll ? 6 : 3;
  const openOrders = isAll ? 5 : isNorte ? 2 : 3;
  const customersToday = Math.round(62 * scale);
  const reservationsToday = isAll ? 9 : isNorte ? 3 : 6;
  const lowStockCount = isAll ? 4 : 2;
  const aiInsights = isAll
    ? [...insightsCentro, ...insightsNorte]
    : isNorte
      ? insightsNorte
      : insightsCentro;

  return {
    revenueToday,
    ordersToday,
    averageTicket: ordersToday
      ? Math.round((revenueToday / ordersToday) * 100) / 100
      : 0,
    openTables,
    openOrders,
    customersToday,
    reservationsToday,
    lowStockCount,
    hourlySales: hourlySales(scale),
    lowStockItems: [],
    aiInsights,
    alerts: alertsFor(branchId, aiInsights, lowStockCount),
  };
}

export function getMockDashboardMetrics(branchId: string | null): DashboardMetrics {
  return metricsForBranch(branchId);
}

export interface MockDashboardDelta {
  revenuePct: number;
  ordersPct: number;
}

export function getMockDeltas(branchId: string | null): MockDashboardDelta {
  if (branchId === "branch_norte") return { revenuePct: 4.2, ordersPct: -1.5 };
  if (branchId === "branch_centro") return { revenuePct: 8.1, ordersPct: 6.4 };
  return { revenuePct: 6.8, ordersPct: 3.2 };
}
