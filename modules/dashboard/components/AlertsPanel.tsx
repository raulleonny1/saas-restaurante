import type { DashboardAlert } from "@/types/dashboard";
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/ui";
import Link from "next/link";

const toneToBadge = {
  warning: "warning",
  danger: "danger",
  accent: "accent",
  neutral: "neutral",
} as const;

const typeLabel = {
  inventory: "Stock",
  ai: "IA",
  ops: "Ops",
} as const;

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card padding="md" className="flex min-w-0 flex-col">
      <CardHeader className="mb-3 sm:mb-4">
        <div className="min-w-0">
          <CardTitle>Alertas</CardTitle>
          <CardDescription>Inventario, IA y operación</CardDescription>
        </div>
        <Badge tone={alerts.length ? "warning" : "success"}>
          {alerts.length ? `${alerts.length} activas` : "Todo OK"}
        </Badge>
      </CardHeader>

      {!alerts.length ? (
        <EmptyState
          title="Sin alertas"
          description="No hay stock crítico ni insights pendientes."
        />
      ) : (
        <ul className="max-h-[22rem] space-y-2.5 overflow-y-auto sm:max-h-[28rem]">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-[var(--radius-md)] border border-border/70 bg-bg-muted/60 px-3 py-3"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{alert.title}</p>
                <Badge tone={toneToBadge[alert.tone]} className="shrink-0">
                  {typeLabel[alert.type]}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-fg-muted">
                {alert.description}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-sm">
        <Link href="/inventory" className="text-accent hover:underline">
          Inventario
        </Link>
        <Link href="/ai" className="text-accent hover:underline">
          Asistente IA
        </Link>
      </div>
    </Card>
  );
}
