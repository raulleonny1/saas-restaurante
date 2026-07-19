import { formatCurrency } from "@/lib/format";
import type { DashboardMetrics } from "@/types/dashboard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/ui";

export function OpsSummary({
  metrics,
  currency,
}: {
  metrics: DashboardMetrics;
  currency: string;
}) {
  const rows = [
    { label: "Pedidos abiertos", value: String(metrics.openOrders) },
    { label: "Reservas hoy", value: String(metrics.reservationsToday) },
    { label: "Clientes hoy", value: String(metrics.customersToday) },
    {
      label: "Ticket medio",
      value: formatCurrency(metrics.averageTicket, currency),
    },
  ];

  return (
    <Card padding="md">
      <CardHeader className="mb-3 sm:mb-4">
        <div>
          <CardTitle>Resumen operativo</CardTitle>
          <CardDescription>Abiertos · reservas · clientes · ticket</CardDescription>
        </div>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[var(--radius-md)] bg-bg-muted px-3 py-3 sm:px-4"
          >
            <p className="text-caption">{row.label}</p>
            <p className="mt-1 text-base font-medium tracking-tight sm:text-lg">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
