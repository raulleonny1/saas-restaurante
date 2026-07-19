"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import {
  Badge,
  Button,
  PageHeader,
  Select,
  Skeleton,
} from "@/ui";
import {
  CalendarDays,
  Package,
  ShoppingBag,
  TriangleAlert,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { AiPulse } from "./components/AiPulse";
import { AlertsPanel } from "./components/AlertsPanel";
import { KpiCard } from "./components/KpiCard";
import { OpsSummary } from "./components/OpsSummary";
import { SalesChart } from "./components/SalesChart";
import { useDashboard } from "./hooks/useDashboard";

export function DashboardView() {
  const { can } = useAuth();
  const {
    restaurantName,
    currency,
    branches,
    branchId,
    setBranchId,
    metrics,
    deltas,
    loading,
    isSimulated,
  } = useDashboard();
  const showCatalog =
    can("catalog.products.manage") || can("catalog.categories.manage");

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Cargando dashboard">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 sm:h-10 sm:w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-32" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-64 w-full sm:h-72" />
          <Skeleton className="h-64 w-full sm:h-72" />
        </div>
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="pb-4 sm:pb-0">
      <PageHeader
        title="Dashboard"
        description={`Pulso de ${restaurantName}: ingresos, pedidos, mesas y alertas.`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {isSimulated ? (
              <Badge tone="neutral" className="w-fit">
                Datos simulados
              </Badge>
            ) : null}
            {showCatalog ? (
              <Link href="/inventory?tab=products">
                <Button size="sm" variant="secondary">
                  <Package className="h-3.5 w-3.5" /> Carta / productos
                </Button>
              </Link>
            ) : null}
            <Select
              aria-label="Sucursal"
              className="w-full min-w-0 sm:min-w-[200px]"
              value={branchId ?? "all"}
              onChange={(e) =>
                setBranchId(e.target.value === "all" ? null : e.target.value)
              }
            >
              <option value="all">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {showCatalog ? (
        <section className="mb-4 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
          <h2 className="text-sm font-medium">Gestión de carta</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Categorías, marca, cantidad, precio unitario y precio por mayor.
            Entra en{" "}
            <Link
              href="/inventory?tab=products"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Carta / Inventario
            </Link>
            .
          </p>
        </section>
      ) : null}

      {/* KPIs: 2×2 mobile → 4 cols desktop (wireframe) */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Ingresos hoy"
          value={formatCurrency(metrics.revenueToday, currency)}
          hint={`${metrics.ordersToday} pedidos cobrados`}
          deltaPct={deltas.revenuePct}
          icon={Wallet}
        />
        <KpiCard
          label="Pedidos hoy"
          value={String(metrics.ordersToday)}
          hint={`${metrics.openOrders} abiertos ahora`}
          deltaPct={deltas.ordersPct}
          icon={ShoppingBag}
        />
        <KpiCard
          label="Mesas abiertas"
          value={String(metrics.openTables)}
          hint="Estado occupied"
          icon={UtensilsCrossed}
        />
        <KpiCard
          label="Alertas"
          value={String(metrics.alerts.length)}
          hint={`${metrics.reservationsToday} reservas hoy`}
          icon={metrics.lowStockCount ? TriangleAlert : CalendarDays}
        />
      </div>

      {/* Chart full-width on mobile; side-by-side on xl */}
      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SalesChart data={metrics.hourlySales} currency={currency} />
        <AlertsPanel alerts={metrics.alerts} />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <div className="animate-fade-up min-w-0">
          <OpsSummary metrics={metrics} currency={currency} />
        </div>
        <div className="animate-fade-up min-w-0">
          <AiPulse insights={metrics.aiInsights} />
        </div>
      </div>
    </div>
  );
}
