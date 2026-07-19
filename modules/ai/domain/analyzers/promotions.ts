import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, paidInWindow } from "@/modules/ai/domain/snapshot";

export function analyzePromotions(snap: BusinessSnapshot): AnalysisFinding {
  const now = Date.now();
  const recent = paidInWindow(snap.orders, daysAgo(21, now), now);
  const qty = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of recent) {
    for (const item of o.items) {
      const cur = qty.get(item.productId) ?? {
        name: item.name,
        qty: 0,
        revenue: 0,
      };
      cur.qty += item.quantity;
      cur.revenue += item.unitPrice * item.quantity;
      qty.set(item.productId, cur);
    }
  }

  const ranked = [...qty.values()].sort((a, b) => b.qty - a.qty);
  const slow = ranked.slice(-Math.min(3, ranked.length)).filter((p) => p.qty > 0);
  const star = ranked[0];

  const atRisk = snap.customers.filter(
    (c) =>
      !c.deletedAt &&
      (c.segments?.includes("at_risk") ||
        c.segments?.includes("dormant") ||
        (c.lastVisitAt &&
          Date.now() - new Date(c.lastVisitAt).getTime() > 30 * 86_400_000)),
  ).length;

  const activePromos = snap.promotions.filter(
    (p) => !p.deletedAt && (p.status === "active" || p.status === "scheduled"),
  ).length;

  const bullets: string[] = [];
  if (atRisk > 0) {
    bullets.push(
      `Hay **${atRisk} clientes** en riesgo/inactivos: una promo “te echamos de menos” del 15–20% suele reactivar visitas.`,
    );
  }
  if (slow.length && star) {
    bullets.push(
      `Empuja **${slow[0].name}** (rotación baja) en combo con **${star.name}** (estrella) — 2x1 o menú del día.`,
    );
  }
  if (activePromos === 0) {
    bullets.push(
      "No hay promociones activas ahora mismo: el vacío de ofertas puede estar frenando ticket y frecuencia.",
    );
  } else {
    bullets.push(
      `Ya tienes ${activePromos} promo(s) vivas; evita saturar: prioriza un mensaje claro por segmento.`,
    );
  }
  if (!bullets.length) {
    bullets.push(
      "Con los datos actuales, empieza por un happy hour en la franja más floja y un cupón de bienvenida para clientes nuevos.",
    );
  }

  return {
    intent: "promotions",
    title: "Promociones recomendadas",
    confidence: 0.72,
    bullets,
    metrics: {
      atRiskCustomers: atRisk,
      activePromotions: activePromos,
    },
    actions: [
      "Crea la promo en Marketing → Promociones y enlázala a una campaña email/WhatsApp.",
      "Limita usos y fecha de caducidad (7–14 días) para medir lift.",
    ],
  };
}
