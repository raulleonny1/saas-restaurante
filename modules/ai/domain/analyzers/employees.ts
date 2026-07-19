import type { AnalysisFinding, BusinessSnapshot } from "@/modules/ai/domain/snapshot";
import { daysAgo, money, paidInWindow } from "@/modules/ai/domain/snapshot";

export function analyzeEmployeeTraining(
  snap: BusinessSnapshot,
): AnalysisFinding {
  const now = Date.now();
  const recent = paidInWindow(snap.orders, daysAgo(30, now), now);
  const byEmp = new Map<
    string,
    { orders: number; revenue: number; tickets: number[] }
  >();

  for (const o of recent) {
    const key = o.servedBy || o.createdBy;
    if (!key) continue;
    const cur = byEmp.get(key) ?? { orders: 0, revenue: 0, tickets: [] };
    cur.orders += 1;
    cur.revenue += o.total;
    cur.tickets.push(o.total);
    byEmp.set(key, cur);
  }

  const resolveName = (id: string) =>
    snap.employees.find((e) => e.id === id || e.uid === id)?.name ?? id;

  const rows = [...byEmp.entries()]
    .map(([id, s]) => {
      const avg = s.orders ? s.revenue / s.orders : 0;
      return { id, name: resolveName(id), ...s, avgTicket: avg };
    })
    .filter((r) => r.orders >= 3)
    .sort((a, b) => a.avgTicket - b.avgTicket);

  const teamAvg =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + r.avgTicket, 0) / rows.length;

  const needs = rows.filter(
    (r) => teamAvg > 0 && r.avgTicket < teamAvg * 0.85,
  );
  const target = needs[0] ?? rows[0];

  const activeWithoutSales = snap.employees.filter(
    (e) =>
      !e.deletedAt &&
      e.status === "active" &&
      !rows.some((r) => r.id === e.id || r.id === e.uid),
  );

  const bullets: string[] = [];
  if (target && needs.length) {
    bullets.push(
      `**${target.name}** tiene el ticket medio más bajo (${money(target.avgTicket, snap.currency)} vs media equipo ${money(teamAvg, snap.currency)}) en ${target.orders} pedidos.`,
    );
    bullets.push(
      "Enfoca capacitación en upselling (acompañamientos, postres, bebidas) y checklist de cierre de mesa.",
    );
  } else if (activeWithoutSales.length) {
    bullets.push(
      `**${activeWithoutSales[0].name}** no aparece en pedidos recientes: conviene shadowing en sala/barra o revisión de PIN/rol POS.`,
    );
  } else if (target) {
    bullets.push(
      `El equipo está equilibrado. El más bajo es **${target.name}** (${money(target.avgTicket, snap.currency)}), aún cerca de la media.`,
    );
  } else {
    bullets.push(
      "No hay suficiente historial de pedidos atribuidos a empleados. Asegura que el POS registre `servedBy`.",
    );
  }

  return {
    intent: "employee_training",
    title: "Capacitación de personal",
    confidence: rows.length >= 2 ? 0.7 : 0.45,
    bullets,
    metrics: {
      teamAvgTicket: Math.round(teamAvg * 100) / 100,
      flagged: needs.length,
    },
    actions: target
      ? [
          `Sesión corta (20 min) con ${target.name}: script de sugerencias y metas de ticket.`,
          "Compara resultados en 7 días desde Reportes → Empleados.",
        ]
      : undefined,
    refs: target
      ? [{ type: "employee", id: target.id, label: target.name }]
      : undefined,
  };
}
