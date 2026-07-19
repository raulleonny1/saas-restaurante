import { analyzeChurnCustomers } from "@/modules/ai/domain/analyzers/customers";
import { analyzeEmployeeTraining } from "@/modules/ai/domain/analyzers/employees";
import { analyzePromotions } from "@/modules/ai/domain/analyzers/promotions";
import { analyzeTopProduct } from "@/modules/ai/domain/analyzers/products";
import { analyzePurchases } from "@/modules/ai/domain/analyzers/purchases";
import { analyzeSalesDrop } from "@/modules/ai/domain/analyzers/sales-drop";
import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, money, paidInWindow } from "@/modules/ai/domain/snapshot";

export function analyzeBriefing(snap: BusinessSnapshot): AnalysisFinding {
  const now = Date.now();
  const today = paidInWindow(snap.orders, daysAgo(1, now), now);
  const week = paidInWindow(snap.orders, daysAgo(7, now), now);
  const todayRev = today.reduce((s, o) => s + o.total, 0);
  const weekRev = week.reduce((s, o) => s + o.total, 0);

  const purchase = analyzePurchases(snap);
  const sales = analyzeSalesDrop(snap);
  const churn = analyzeChurnCustomers(snap);
  const promo = analyzePromotions(snap);
  const product = analyzeTopProduct(snap);
  const staff = analyzeEmployeeTraining(snap);

  const priorities: string[] = [];
  if ((purchase.metrics?.itemsToBuy as number) > 0) {
    priorities.push(`Compras: ${purchase.bullets[0]}`);
  }
  if ((sales.metrics?.deltaPct as number) < -5) {
    priorities.push(`Ventas: ${sales.bullets[0]}`);
  }
  if ((churn.metrics?.churnCandidates as number) > 0) {
    priorities.push(`CRM: ${churn.bullets[0]}`);
  }
  priorities.push(`Producto estrella: ${product.bullets[0]}`);
  priorities.push(`Promo: ${promo.bullets[0]}`);
  if (staff.bullets[0]) priorities.push(`Equipo: ${staff.bullets[0]}`);

  return {
    intent: "briefing",
    title: "Briefing de gerente",
    confidence: 0.76,
    bullets: [
      `Hoy llevas **${money(todayRev, snap.currency)}** en ${today.length} pedidos; últimos 7 días **${money(weekRev, snap.currency)}**.`,
      `Base analizada: ${snap.orders.length} pedidos · ${snap.customers.length} clientes · ${snap.products.length} productos · ${snap.levels.length} niveles de stock · ${snap.employees.length} empleados.`,
      ...priorities.slice(0, 5),
    ],
    metrics: {
      todayRevenue: Math.round(todayRev * 100) / 100,
      weekRevenue: Math.round(weekRev * 100) / 100,
    },
    actions: [
      ...(purchase.actions?.slice(0, 1) ?? []),
      ...(churn.actions?.slice(0, 1) ?? []),
      ...(promo.actions?.slice(0, 1) ?? []),
    ],
  };
}

export function runAllAnalyzers(snap: BusinessSnapshot): AnalysisFinding[] {
  return [
    analyzeBriefing(snap),
    analyzePurchases(snap),
    analyzeTopProduct(snap),
    analyzeSalesDrop(snap),
    analyzePromotions(snap),
    analyzeEmployeeTraining(snap),
    analyzeChurnCustomers(snap),
  ];
}
