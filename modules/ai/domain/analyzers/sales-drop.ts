import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, money, paidInWindow } from "@/modules/ai/domain/snapshot";

export function analyzeSalesDrop(snap: BusinessSnapshot): AnalysisFinding {
  const now = Date.now();
  const cur = paidInWindow(snap.orders, daysAgo(7, now), now);
  const prev = paidInWindow(snap.orders, daysAgo(14, now), daysAgo(7, now));

  const rev = (orders: typeof cur) =>
    orders.reduce((s, o) => s + o.total, 0);
  const curRev = rev(cur);
  const prevRev = rev(prev);
  const delta = prevRev === 0 ? (curRev > 0 ? 1 : 0) : (curRev - prevRev) / prevRev;

  const channel = (orders: typeof cur) => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.channel, (m.get(o.channel) ?? 0) + o.total);
    return m;
  };
  const chCur = channel(cur);
  const chPrev = channel(prev);
  const channelDeltas = [...new Set([...chCur.keys(), ...chPrev.keys()])]
    .map((c) => {
      const a = chCur.get(c) ?? 0;
      const b = chPrev.get(c) ?? 0;
      const d = b === 0 ? (a > 0 ? 1 : 0) : (a - b) / b;
      return { channel: c, delta: d, cur: a, prev: b };
    })
    .sort((x, y) => x.delta - y.delta);

  const ticketCur = cur.length ? curRev / cur.length : 0;
  const ticketPrev = prev.length ? prevRev / prev.length : 0;
  const orderDelta =
    prev.length === 0
      ? cur.length > 0
        ? 1
        : 0
      : (cur.length - prev.length) / prev.length;

  const reasons: string[] = [];
  if (delta >= -0.05) {
    reasons.push(
      `En los últimos 7 días facturaste **${money(curRev, snap.currency)}** vs **${money(prevRev, snap.currency)}** la semana previa (Δ ${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%). No hay una caída relevante.`,
    );
  } else {
    reasons.push(
      `Las ventas cayeron **${Math.round(Math.abs(delta) * 100)}%**: ${money(curRev, snap.currency)} frente a ${money(prevRev, snap.currency)}.`,
    );
    if (orderDelta < -0.08) {
      reasons.push(
        `El volumen de pedidos bajó ${Math.round(Math.abs(orderDelta) * 100)}% (${cur.length} vs ${prev.length}). El problema parece de **afluencia**, no solo de ticket.`,
      );
    }
    if (ticketPrev > 0 && ticketCur / ticketPrev < 0.92) {
      reasons.push(
        `El ticket medio bajó de ${money(ticketPrev, snap.currency)} a ${money(ticketCur, snap.currency)} (más descuentos, menús baratos o menos upselling).`,
      );
    }
    const worst = channelDeltas[0];
    if (worst && worst.delta < -0.1) {
      reasons.push(
        `El canal **${worst.channel}** es el que más pesa en la caída (Δ ${Math.round(worst.delta * 100)}%).`,
      );
    }
    const wasteCost = snap.waste
      .filter((w) => new Date(w.createdAt).getTime() >= daysAgo(7, now))
      .reduce((s, w) => s + w.costImpact, 0);
    if (wasteCost > curRev * 0.05 && curRev > 0) {
      reasons.push(
        `La merma de la semana (${money(wasteCost, snap.currency)}) es alta respecto a la facturación; puede estar forzando menús más cortos.`,
      );
    }
  }

  return {
    intent: "sales_drop",
    title: "Diagnóstico de ventas",
    confidence: prevRev > 0 || curRev > 0 ? 0.8 : 0.45,
    bullets: reasons,
    metrics: {
      currentRevenue: Math.round(curRev * 100) / 100,
      previousRevenue: Math.round(prevRev * 100) / 100,
      deltaPct: Math.round(delta * 1000) / 10,
      ordersCurrent: cur.length,
      ordersPrevious: prev.length,
    },
    actions:
      delta < -0.05
        ? [
            "Lanza una promo win-back a clientes en riesgo (ver CRM / Marketing).",
            "Revisa horarios pico: concentra personal y ofertas ahí.",
            "Comprueba si hubo cierres, clima o eventos locales no capturados.",
          ]
        : ["Mantén el ritmo y vigila el canal más volátil la próxima semana."],
  };
}
