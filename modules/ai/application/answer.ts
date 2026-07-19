import { analyzeBriefing } from "@/modules/ai/domain/analyzers/briefing";
import { analyzeChurnCustomers } from "@/modules/ai/domain/analyzers/customers";
import { analyzeEmployeeTraining } from "@/modules/ai/domain/analyzers/employees";
import { analyzePromotions } from "@/modules/ai/domain/analyzers/promotions";
import { analyzeTopProduct } from "@/modules/ai/domain/analyzers/products";
import { analyzePurchases } from "@/modules/ai/domain/analyzers/purchases";
import { analyzeSalesDrop } from "@/modules/ai/domain/analyzers/sales-drop";
import {
  classifyIntent,
  type ManagerIntent,
} from "@/modules/ai/domain/intents";
import type {
  AnalysisFinding,
  BusinessSnapshot,
} from "@/modules/ai/domain/snapshot";

function runIntent(
  intent: ManagerIntent,
  snap: BusinessSnapshot,
): AnalysisFinding {
  switch (intent) {
    case "purchase":
      return analyzePurchases(snap);
    case "top_product":
      return analyzeTopProduct(snap);
    case "sales_drop":
      return analyzeSalesDrop(snap);
    case "promotions":
      return analyzePromotions(snap);
    case "employee_training":
      return analyzeEmployeeTraining(snap);
    case "churn_customers":
      return analyzeChurnCustomers(snap);
    case "briefing":
      return analyzeBriefing(snap);
    case "general":
    default:
      return analyzeBriefing(snap);
  }
}

/** Convert structured finding to natural-language manager reply (local). */
export function findingToNaturalLanguage(
  finding: AnalysisFinding,
  question: string,
): string {
  const lines: string[] = [];
  lines.push(`### ${finding.title}`);
  lines.push("");
  for (const b of finding.bullets) {
    lines.push(`- ${b}`);
  }
  if (finding.actions?.length) {
    lines.push("");
    lines.push("**Acciones recomendadas**");
    for (const a of finding.actions) {
      lines.push(`1. ${a}`);
    }
  }
  lines.push("");
  lines.push("");
  lines.push(
    `Confianza del análisis: ${Math.round(finding.confidence * 100)}% — basado en pedidos, stock, CRM y equipo de tu restaurante.`,
  );
  void question;
  return lines.join("\n").replace(/\*\*/g, "");
}

export interface ManagerAnswer {
  intent: ManagerIntent;
  finding: AnalysisFinding;
  content: string;
  model: string;
}

export function answerLocally(
  snap: BusinessSnapshot,
  message: string,
): ManagerAnswer {
  const intent = classifyIntent(message);
  const finding = runIntent(intent, snap);
  const content = findingToNaturalLanguage(finding, message);
  return {
    intent,
    finding,
    content,
    model: "smartserve-manager-local",
  };
}

/** Compact context for optional LLM rewrite (no PII dumps). */
export function buildLlmBrief(
  snap: BusinessSnapshot,
  finding: AnalysisFinding,
): string {
  return JSON.stringify(
    {
      restaurant: snap.restaurantName,
      currency: snap.currency,
      counts: {
        orders: snap.orders.length,
        customers: snap.customers.length,
        products: snap.products.length,
        stockLevels: snap.levels.length,
        employees: snap.employees.length,
      },
      finding: {
        intent: finding.intent,
        title: finding.title,
        confidence: finding.confidence,
        bullets: finding.bullets,
        metrics: finding.metrics,
        actions: finding.actions,
      },
    },
    null,
    2,
  );
}
