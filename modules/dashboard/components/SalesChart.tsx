"use client";

import { chartTheme, chartTooltipStyle } from "@/lib/chart-theme";
import { formatCurrency } from "@/lib/format";
import type { HourlySalesPoint } from "@/types/dashboard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/ui";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SalesChart({
  data,
  currency,
}: {
  data: HourlySalesPoint[];
  currency: string;
}) {
  const hasData = data.some((d) => d.amount > 0);

  return (
    <Card padding="md" className="min-w-0">
      <CardHeader className="mb-3 sm:mb-4">
        <div className="min-w-0">
          <CardTitle>Ventas por hora</CardTitle>
          <CardDescription>Ingresos cobrados hoy</CardDescription>
        </div>
      </CardHeader>

      {!hasData ? (
        <div className="flex h-52 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-bg-muted/40 px-4 text-center text-sm text-fg-muted sm:h-64 sm:px-6">
          Aún no hay cobros hoy. Cuando el POS registre pedidos pagados, verás la
          curva aquí.
        </div>
      ) : (
        <div className="h-52 w-full min-w-0 sm:h-64 lg:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={chartTheme.areaGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={chartTheme.colors[0]}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={chartTheme.colors[0]}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                stroke={chartTheme.axis}
                fontSize={11}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                stroke={chartTheme.axis}
                fontSize={11}
                width={40}
                tickFormatter={(v) => `${Math.round(Number(v))}`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle()}
                formatter={(value) => [
                  formatCurrency(Number(value ?? 0), currency),
                  "Ingresos",
                ]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={chartTheme.colors[0]}
                fill={`url(#${chartTheme.areaGradientId})`}
                strokeWidth={chartTheme.strokeWidth}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
