"use client";

import { ChartCard } from "@/modules/reports/components/ChartCard";
import {
  AreaSeriesChart,
  BarSeriesChart,
  CompareLineChart,
  PieNamedChart,
} from "@/modules/reports/components/charts";
import { KpiGrid } from "@/modules/reports/components/KpiGrid";
import { useReports } from "@/modules/reports/context/ReportsProvider";

export function SalesPanel() {
  const { sales, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          { label: "Ingresos", value: sales.revenue, format: "currency", currency },
          { label: "Pedidos", value: sales.orders, format: "number" },
          { label: "Ticket medio", value: sales.avgTicket, format: "currency", currency },
          { label: "Propinas", value: sales.tips, format: "currency", currency },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Ventas por día"
          description="Ingresos cobrados en el periodo"
          empty={!sales.byDay.some((d) => d.value > 0)}
        >
          <AreaSeriesChart data={sales.byDay} currency={currency} valueName="Ingresos" />
        </ChartCard>
        <ChartCard
          title="Mix por canal"
          description="POS, delivery, takeaway…"
          empty={!sales.byChannel.length}
        >
          <PieNamedChart data={sales.byChannel} currency={currency} />
        </ChartCard>
      </div>
    </div>
  );
}

export function ProfitPanel() {
  const { profit, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          { label: "Ingresos", value: profit.revenue, format: "currency", currency },
          {
            label: "Coste estimado",
            value: profit.estimatedCost,
            format: "currency",
            currency,
          },
          {
            label: "Beneficio bruto",
            value: profit.grossProfit,
            format: "currency",
            currency,
          },
          { label: "Margen", value: profit.margin, format: "percent" },
        ]}
      />
      <ChartCard
        title="Utilidad diaria"
        description="Beneficio estimado (ingresos − coste − merma del día)"
        empty={!profit.byDay.some((d) => d.value !== 0 || (d.secondary ?? 0) > 0)}
      >
        <AreaSeriesChart
          data={profit.byDay}
          currency={currency}
          valueName="Beneficio"
          secondaryKey="secondary"
          secondaryName="Ingresos"
        />
      </ChartCard>
    </div>
  );
}

export function ProductsPanel() {
  const { products, currency } = useReports();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top productos por ingresos"
          empty={!products.topByRevenue.length}
        >
          <BarSeriesChart
            data={products.topByRevenue}
            currency={currency}
            horizontal
          />
        </ChartCard>
        <ChartCard
          title="Top productos por unidades"
          empty={!products.topByQty.length}
        >
          <BarSeriesChart
            data={products.topByQty}
            currency={currency}
            horizontal
            asCurrency={false}
          />
        </ChartCard>
      </div>
      <ChartCard
        title="Mix por categoría"
        empty={!products.categoryMix.length}
        className="max-w-2xl"
      >
        <PieNamedChart data={products.categoryMix} currency={currency} />
      </ChartCard>
    </div>
  );
}

export function CustomersPanel() {
  const { customers, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          { label: "Clientes activos", value: customers.active },
          { label: "Nuevos en periodo", value: customers.newInPeriod },
          { label: "Recurrentes", value: customers.returning },
          {
            label: "LTV medio",
            value: customers.avgLtv,
            format: "currency",
            currency,
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top gastadores del periodo"
          empty={!customers.topSpenders.length}
        >
          <BarSeriesChart
            data={customers.topSpenders}
            currency={currency}
            horizontal
          />
        </ChartCard>
        <ChartCard title="Distribución por tier" empty={!customers.byTier.length}>
          <PieNamedChart data={customers.byTier} asCurrency={false} />
        </ChartCard>
      </div>
    </div>
  );
}

export function InventoryPanel() {
  const { inventory, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          { label: "SKUs en stock", value: inventory.skus },
          { label: "Bajo mínimo", value: inventory.lowStock },
          {
            label: "Valor inventario",
            value: inventory.stockValue,
            format: "currency",
            currency,
          },
          {
            label: "Merma (periodo)",
            value: inventory.wasteCost,
            format: "currency",
            currency,
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Ingredientes bajo mínimo"
          empty={!inventory.lowStockItems.length}
        >
          <BarSeriesChart
            data={inventory.lowStockItems}
            horizontal
            asCurrency={false}
          />
        </ChartCard>
        <ChartCard
          title="Merma por motivo"
          empty={!inventory.wasteByReason.length}
        >
          <PieNamedChart data={inventory.wasteByReason} currency={currency} />
        </ChartCard>
      </div>
    </div>
  );
}

export function EmployeesPanel() {
  const { employees, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          { label: "Empleados activos", value: employees.active },
          {
            label: "Horas de turno",
            value: employees.shiftHours,
            format: "hours",
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Ventas atribuibles"
          description="Por servedBy / createdBy del pedido"
          empty={!employees.bySales.length}
        >
          <BarSeriesChart
            data={employees.bySales}
            currency={currency}
            horizontal
          />
        </ChartCard>
        <ChartCard
          title="Horas trabajadas"
          empty={!employees.byHours.length}
        >
          <BarSeriesChart
            data={employees.byHours}
            currency={currency}
            horizontal
            asCurrency={false}
          />
        </ChartCard>
      </div>
    </div>
  );
}

export function PeaksPanel() {
  const { peaks, currency } = useReports();
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-4 py-3">
        <p className="text-caption text-fg-muted">Hora pico del periodo</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-fg">
          {peaks.peakHourLabel}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Ingresos por hora"
          empty={!peaks.byHour.some((h) => h.value > 0)}
        >
          <AreaSeriesChart
            data={peaks.byHour}
            currency={currency}
            valueName="Ingresos"
          />
        </ChartCard>
        <ChartCard
          title="Por día de la semana"
          empty={!peaks.byWeekday.some((d) => d.value > 0)}
        >
          <BarSeriesChart data={peaks.byWeekday} currency={currency} />
        </ChartCard>
      </div>
    </div>
  );
}

export function ComparePanel() {
  const { compare, currency } = useReports();
  return (
    <div className="space-y-4">
      <KpiGrid
        items={[
          {
            label: "Ingresos",
            value: compare.current.revenue,
            format: "currency",
            currency,
            delta: compare.deltas.revenue,
          },
          {
            label: "Pedidos",
            value: compare.current.orders,
            delta: compare.deltas.orders,
          },
          {
            label: "Ticket medio",
            value: compare.current.avgTicket,
            format: "currency",
            currency,
            delta: compare.deltas.avgTicket,
          },
          {
            label: "Beneficio",
            value: compare.current.profit,
            format: "currency",
            currency,
            delta: compare.deltas.profit,
          },
        ]}
      />
      <ChartCard
        title="Actual vs periodo anterior"
        description="Misma duración desplazada hacia atrás"
        empty={!compare.series.some((s) => s.value > 0 || (s.secondary ?? 0) > 0)}
      >
        <CompareLineChart data={compare.series} currency={currency} />
      </ChartCard>
    </div>
  );
}
