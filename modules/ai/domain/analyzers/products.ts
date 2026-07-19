import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, money, paidInWindow } from "@/modules/ai/domain/snapshot";

export function analyzeTopProduct(snap: BusinessSnapshot): AnalysisFinding {
  const now = Date.now();
  const recent = paidInWindow(snap.orders, daysAgo(14, now), now);
  const prior = paidInWindow(snap.orders, daysAgo(28, now), daysAgo(14, now));

  const score = (orders: typeof recent) => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      for (const item of o.items) {
        const cur = map.get(item.productId) ?? {
          name: item.name,
          qty: 0,
          revenue: 0,
        };
        cur.qty += item.quantity;
        cur.revenue += item.unitPrice * item.quantity;
        map.set(item.productId, cur);
      }
    }
    return map;
  };

  const a = score(recent);
  const b = score(prior);

  const ranked = [...a.entries()]
    .map(([id, cur]) => {
      const prev = b.get(id);
      const prevQty = prev?.qty ?? 0;
      const growth = prevQty === 0 ? (cur.qty > 0 ? 1 : 0) : (cur.qty - prevQty) / prevQty;
      const momentum = cur.qty * (1 + Math.max(0, growth));
      return { id, ...cur, growth, momentum, prevQty };
    })
    .sort((x, y) => y.momentum - x.momentum);

  const top = ranked[0];
  const runners = ranked.slice(0, 5);

  return {
    intent: "top_product",
    title: "Producto con mejor proyección",
    confidence: top ? 0.74 : 0.4,
    bullets: top
      ? [
          `**${top.name}** es el candidato más fuerte: ${top.qty} ud. en 14 días (${money(top.revenue, snap.currency)}), tendencia ${top.growth >= 0 ? "+" : ""}${Math.round(top.growth * 100)}% vs la quincena anterior.`,
          ...runners.slice(1, 4).map(
            (r) =>
              `${r.name}: ${r.qty} ud. · Δ ${r.growth >= 0 ? "+" : ""}${Math.round(r.growth * 100)}%.`,
          ),
        ]
      : [
          "Aún no hay suficientes pedidos pagados para proyectar un best-seller. Sigue operando el POS unos días.",
        ],
    metrics: {
      leaderQty: top?.qty ?? 0,
      leaderGrowthPct: top ? Math.round(top.growth * 100) : 0,
    },
    actions: top
      ? [
          `Asegura stock/receta de **${top.name}** para el fin de semana.`,
          "Destácalo en carta digital o menú del día.",
        ]
      : undefined,
    refs: top
      ? [{ type: "product", id: top.id, label: top.name }]
      : undefined,
  };
}
