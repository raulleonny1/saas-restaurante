import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, money } from "@/modules/ai/domain/snapshot";

export function analyzeChurnCustomers(
  snap: BusinessSnapshot,
): AnalysisFinding {
  const now = Date.now();
  const dormant = snap.customers
    .filter((c) => !c.deletedAt)
    .map((c) => {
      const last = c.lastVisitAt ? new Date(c.lastVisitAt).getTime() : 0;
      const days = last ? Math.floor((now - last) / 86_400_000) : 999;
      return { c, days };
    })
    .filter(
      ({ c, days }) =>
        days >= 30 ||
        c.segments?.includes("dormant") ||
        c.segments?.includes("at_risk"),
    )
    .sort((a, b) => {
      const score = (x: typeof a) =>
        (x.c.totalSpent ?? 0) * 0.01 + (x.c.valueScore ?? 0) - x.days * 0.1;
      return score(b) - score(a);
    });

  const top = dormant.slice(0, 8);
  const highValue = top.filter(
    (x) =>
      (x.c.totalSpent ?? 0) >= 100 ||
      x.c.segments?.includes("vip") ||
      x.c.segments?.includes("high_value"),
  );

  return {
    intent: "churn_customers",
    title: "Clientes que dejaron de venir",
    confidence: snap.customers.length ? 0.82 : 0.4,
    bullets: top.length
      ? [
          `Detecté **${dormant.length} clientes** sin visita ≥30 días o en segmento riesgo/inactivo.`,
          ...top.slice(0, 5).map(
            ({ c, days }) =>
              `**${c.name}**: ${days === 999 ? "sin visitas registradas" : `${days} días`} · LTV ${money(c.totalSpent ?? 0, snap.currency)}${c.phone || c.email ? "" : " · sin contacto"}.`,
          ),
          highValue.length
            ? `Prioriza a ${highValue.length} de alto valor (VIP / alto gasto) para contacto personal.`
            : "Ninguno de la lista corta es VIP; igualmente un win-back masivo ayuda.",
        ]
      : [
          "No hay señales claras de abandono con los datos actuales. Buen ritmo de retención.",
        ],
    metrics: {
      churnCandidates: dormant.length,
      highValueAtRisk: highValue.length,
      sinceDays: 30,
    },
    actions: top.length
      ? [
          "Automatización Marketing → trigger `at_risk` / `dormant`.",
          "Llama a los 3 primeros de alto valor esta semana.",
        ]
      : undefined,
    refs: top.slice(0, 5).map(({ c }) => ({
      type: "customer",
      id: c.id,
      label: c.name,
    })),
  };
}
