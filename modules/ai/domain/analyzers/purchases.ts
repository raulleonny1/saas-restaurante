import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, paidInWindow } from "@/modules/ai/domain/snapshot";

/** Suggest what to buy tomorrow from stock cover + recent sales burn. */
export function analyzePurchases(snap: BusinessSnapshot): AnalysisFinding {
  const now = Date.now();
  const recent = paidInWindow(snap.orders, daysAgo(14, now), now);
  const usage = new Map<string, number>();

  const productById = new Map(snap.products.map((p) => [p.id, p]));
  for (const o of recent) {
    for (const item of o.items) {
      const product = productById.get(item.productId);
      if (!product?.recipe?.length) continue;
      for (const r of product.recipe) {
        usage.set(
          r.ingredientId,
          (usage.get(r.ingredientId) ?? 0) + r.quantity * item.quantity,
        );
      }
    }
  }

  const ingName = new Map(snap.ingredients.map((i) => [i.id, i]));
  const suggestions: Array<{
    id: string;
    name: string;
    qty: number;
    unit: string;
    days: number;
    reason: string;
  }> = [];

  for (const level of snap.levels) {
    const ing = ingName.get(level.ingredientId);
    if (!ing) continue;
    const used14 = usage.get(level.ingredientId) ?? 0;
    const daily = used14 / 14;
    const daysOfCover =
      daily > 0 ? level.quantity / daily : level.quantity > 0 ? 99 : 0;
    const belowMin = level.quantity <= level.minStock;
    if (!belowMin && daysOfCover > 2.5) continue;

    const target = Math.max(level.minStock * 2, daily * 3);
    const buyQty = Math.max(0, Math.ceil((target - level.quantity) * 10) / 10);
    if (buyQty <= 0 && !belowMin) continue;

    suggestions.push({
      id: level.ingredientId,
      name: ing.name,
      qty: buyQty || Math.max(level.minStock - level.quantity, daily),
      unit: level.unit,
      days: Math.round(daysOfCover * 10) / 10,
      reason: belowMin
        ? `bajo mínimo (${level.quantity} ≤ ${level.minStock})`
        : `cobertura ~${daysOfCover.toFixed(1)} días`,
    });
  }

  suggestions.sort((a, b) => a.days - b.days);
  const top = suggestions.slice(0, 8);
  const currency = snap.currency;

  return {
    intent: "purchase",
    title: "Compras recomendadas para mañana",
    confidence: top.length ? 0.78 : 0.55,
    bullets: top.length
      ? top.map(
          (s) =>
            `**${s.name}**: pedir ~${s.qty} ${s.unit} (${s.reason}).`,
        )
      : [
          "El stock actual cubre más de 2–3 días con el ritmo de ventas de las últimas 2 semanas. No veo compras urgentes.",
        ],
    metrics: {
      itemsToBuy: top.length,
      lookbackDays: 14,
      currency,
    },
    actions: top.length
      ? [
          "Confirma lead time con proveedores habituales.",
          "Prioriza los 3 primeros ítems si el presupuesto es justado.",
        ]
      : ["Revisa mermas semanales por si hay consumo oculto."],
    refs: top.map((s) => ({
      type: "ingredient",
      id: s.id,
      label: s.name,
    })),
  };
}
