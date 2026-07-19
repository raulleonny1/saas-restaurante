import type { AiInsight } from "./ai";
import type { InventoryLevel } from "./inventory";

export interface HourlySalesPoint {
  hour: string;
  amount: number;
  orders: number;
}

export interface DashboardAlert {
  id: string;
  type: "inventory" | "ai" | "ops";
  tone: "warning" | "danger" | "accent" | "neutral";
  title: string;
  description: string;
}

export interface DashboardMetrics {
  revenueToday: number;
  ordersToday: number;
  averageTicket: number;
  openTables: number;
  openOrders: number;
  customersToday: number;
  reservationsToday: number;
  lowStockCount: number;
  hourlySales: HourlySalesPoint[];
  lowStockItems: InventoryLevel[];
  aiInsights: AiInsight[];
  alerts: DashboardAlert[];
}

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  revenueToday: 0,
  ordersToday: 0,
  averageTicket: 0,
  openTables: 0,
  openOrders: 0,
  customersToday: 0,
  reservationsToday: 0,
  lowStockCount: 0,
  hourlySales: [],
  lowStockItems: [],
  aiInsights: [],
  alerts: [],
};
