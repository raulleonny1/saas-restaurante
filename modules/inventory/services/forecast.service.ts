"use client";

/**
 * Inventory AI predictions — heuristic burn-rate model aligned with the
 * AI module architecture (stock_prediction). Writes inventoryPredictions
 * and optional aiInsights for the dashboard inbox.
 */

import { getDb } from "@/lib/firebase";
import { nowIso, roundQty } from "@/modules/inventory/domain/ids";
import type { Ingredient } from "@/types/catalog";
import type {
  InventoryLevel,
  InventoryMovement,
  InventoryPrediction,
} from "@/types/inventory";
import type { AiInsight } from "@/types/ai";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribePredictions(
  restaurantId: string,
  branchId: string,
  onData: (rows: InventoryPrediction[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "inventoryPredictions"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as InventoryPrediction,
        ),
      );
    },
    (err) => onError?.(err),
  );
}

export function computePredictions(input: {
  restaurantId: string;
  branchId: string;
  levels: InventoryLevel[];
  movements: InventoryMovement[];
  ingredients: Ingredient[];
  lookbackDays?: number;
}): InventoryPrediction[] {
  const lookback = input.lookbackDays ?? 14;
  const since = Date.now() - lookback * 86_400_000;
  const ingById = new Map(input.ingredients.map((i) => [i.id, i]));
  const stamp = nowIso();
  const out: InventoryPrediction[] = [];

  for (const level of input.levels) {
    const ingredient = ingById.get(level.ingredientId);
    if (!ingredient) continue;

    const usageMoves = input.movements.filter(
      (m) =>
        m.ingredientId === level.ingredientId &&
        m.delta < 0 &&
        new Date(m.createdAt).getTime() >= since,
    );
    const totalUsed = usageMoves.reduce((s, m) => s + Math.abs(m.delta), 0);
    const avgDailyUsage = roundQty(totalUsed / lookback);
    const daysOfCover =
      avgDailyUsage > 0
        ? roundQty(level.quantity / avgDailyUsage)
        : level.quantity > 0
          ? 999
          : 0;
    const suggestedReorderQty = roundQty(
      Math.max(
        0,
        level.minStock * 2 - level.quantity,
        avgDailyUsage * 7 - level.quantity,
      ),
    );

    let confidence = 0.45;
    if (usageMoves.length >= 5) confidence = 0.72;
    if (usageMoves.length >= 15) confidence = 0.88;

    const rationale =
      avgDailyUsage <= 0
        ? "Sin consumo reciente; cobertura alta o stock parado."
        : `Consumo medio ${avgDailyUsage} ${level.unit}/día (${lookback}d). Quiebre estimado en ~${daysOfCover} días.`;

    out.push({
      id: `${input.branchId}__${level.ingredientId}`,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      ingredientId: level.ingredientId,
      ingredientName: ingredient.name,
      daysOfCover,
      avgDailyUsage,
      suggestedReorderQty,
      unit: level.unit,
      confidence,
      rationale,
      generatedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  return out.sort((a, b) => a.daysOfCover - b.daysOfCover);
}

export async function persistPredictions(input: {
  restaurantId: string;
  branchId: string;
  predictions: InventoryPrediction[];
  writeInsights?: boolean;
}): Promise<void> {
  const batch = writeBatch(getDb());
  const stamp = nowIso();

  for (const p of input.predictions) {
    batch.set(
      doc(
        getDb(),
        "restaurants",
        input.restaurantId,
        "inventoryPredictions",
        p.id,
      ),
      { ...p, updatedAt: stamp },
    );

    if (input.writeInsights && p.daysOfCover < 3 && p.avgDailyUsage > 0) {
      const insightId = `inv_pred_${p.id}`;
      const insight: AiInsight = {
        id: insightId,
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        type: "stock_prediction",
        status: "new",
        title: `${p.ingredientName}: quiebre en ~${p.daysOfCover}d`,
        summary: `${p.rationale} Pedido sugerido: ${p.suggestedReorderQty} ${p.unit}.`,
        confidence: p.confidence,
        data: {
          ingredientId: p.ingredientId,
          daysOfCover: p.daysOfCover,
          suggestedReorderQty: p.suggestedReorderQty,
        },
        generatedBy: "system",
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      };
      batch.set(
        doc(getDb(), "restaurants", input.restaurantId, "aiInsights", insightId),
        insight,
        // merge not available on set with writeBatch the same way - use set overwrite
      );
    }
  }

  await batch.commit();
}

export function lowStockAlerts(
  levels: InventoryLevel[],
  ingredients: Ingredient[],
): Array<{
  id: string;
  ingredientId: string;
  name: string;
  quantity: number;
  minStock: number;
  unit: string;
}> {
  const ing = new Map(ingredients.map((i) => [i.id, i]));
  return levels
    .filter((l) => l.quantity <= l.minStock)
    .map((l) => ({
      id: l.id,
      ingredientId: l.ingredientId,
      name: ing.get(l.ingredientId)?.name ?? l.ingredientId,
      quantity: l.quantity,
      minStock: l.minStock,
      unit: l.unit,
    }));
}
