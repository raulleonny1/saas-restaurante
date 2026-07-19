"use client";

import { getDb } from "@/lib/firebase";
import { runAllAnalyzers } from "@/modules/ai/domain/analyzers/briefing";
import { newId, nowIso } from "@/modules/ai/domain/ids";
import type { BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import type { AiInsight, AiInsightType } from "@/types/ai";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

const INTENT_TYPE: Record<string, AiInsightType> = {
  purchase: "stock_prediction",
  top_product: "demand_forecast",
  sales_drop: "sales_drop",
  promotions: "promotion_suggestion",
  employee_training: "employee_performance",
  churn_customers: "custom",
  briefing: "custom",
};

export function subscribeInsights(
  restaurantId: string,
  onData: (rows: AiInsight[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "aiInsights"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AiInsight)
          .filter((i) => !i.deletedAt && i.status !== "dismissed")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function refreshManagerInsights(
  snap: BusinessSnapshot,
): Promise<number> {
  const findings = runAllAnalyzers(snap).filter((f) => f.intent !== "briefing");
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  let n = 0;

  for (const f of findings.slice(0, 6)) {
    const id = newId("ain");
    const insight: AiInsight = {
      id,
      restaurantId: snap.restaurantId,
      branchId: null,
      type: INTENT_TYPE[f.intent] ?? "custom",
      status: "new",
      title: f.title,
      summary: f.bullets[0]?.replace(/\*\*/g, "") ?? f.title,
      confidence: f.confidence,
      data: {
        bullets: f.bullets,
        metrics: f.metrics,
        actions: f.actions,
      },
      generatedBy: "system",
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    batch.set(
      doc(getDb(), "restaurants", snap.restaurantId, "aiInsights", id),
      insight,
    );
    n += 1;
  }

  await batch.commit();
  return n;
}

export async function dismissInsight(
  restaurantId: string,
  insightId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "aiInsights", insightId),
    { status: "dismissed", updatedAt: nowIso() },
  );
  await batch.commit();
}
