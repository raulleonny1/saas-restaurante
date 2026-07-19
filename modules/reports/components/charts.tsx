"use client";

import { chartTheme, chartTooltipStyle } from "@/lib/chart-theme";
import { formatCurrency } from "@/lib/format";
import type { NamedValue, SeriesPoint } from "@/modules/reports/domain/aggregates";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AreaSeriesChart({
  data,
  currency = "EUR",
  valueKey = "value",
  secondaryKey,
  valueName = "Valor",
  secondaryName,
}: {
  data: SeriesPoint[];
  currency?: string;
  valueKey?: "value" | "secondary";
  secondaryKey?: "value" | "secondary";
  valueName?: string;
  secondaryName?: string;
}) {
  const gid = `${chartTheme.areaGradientId}_${valueName.replace(/\s/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartTheme.colors[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chartTheme.colors[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          stroke={chartTheme.axis}
          fontSize={11}
          minTickGap={24}
        />
        <YAxis
          stroke={chartTheme.axis}
          fontSize={11}
          width={44}
          tickFormatter={(v) => String(Math.round(Number(v)))}
        />
        <Tooltip
          contentStyle={chartTooltipStyle()}
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0), currency),
            String(name),
          ]}
        />
        {secondaryKey ? <Legend /> : null}
        <Area
          type="monotone"
          dataKey={valueKey}
          name={valueName}
          stroke={chartTheme.colors[0]}
          fill={`url(#${gid})`}
          strokeWidth={chartTheme.strokeWidth}
        />
        {secondaryKey ? (
          <Area
            type="monotone"
            dataKey={secondaryKey}
            name={secondaryName ?? "Secundario"}
            stroke={chartTheme.colors[1]}
            fill="transparent"
            strokeWidth={chartTheme.strokeWidth}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeriesChart({
  data,
  currency = "EUR",
  horizontal,
  asCurrency = true,
}: {
  data: NamedValue[];
  currency?: string;
  horizontal?: boolean;
  asCurrency?: boolean;
}) {
  const chartData = data.map((d) => ({
    name: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
    value: d.value,
  }));
  const fmt = (v: number) =>
    asCurrency
      ? formatCurrency(v, currency)
      : new Intl.NumberFormat("es-ES").format(v);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, left: horizontal ? 8 : 0, bottom: 0 }}
      >
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              stroke={chartTheme.axis}
              fontSize={11}
              tickFormatter={(v) => String(Math.round(Number(v)))}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={chartTheme.axis}
              fontSize={11}
              width={88}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={11} />
            <YAxis
              stroke={chartTheme.axis}
              fontSize={11}
              width={44}
              tickFormatter={(v) => String(Math.round(Number(v)))}
            />
          </>
        )}
        <Tooltip
          contentStyle={chartTooltipStyle()}
          formatter={(value) => [fmt(Number(value ?? 0)), "Valor"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill={chartTheme.colors[i % chartTheme.colors.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieNamedChart({
  data,
  currency = "EUR",
  asCurrency = true,
}: {
  data: NamedValue[];
  currency?: string;
  asCurrency?: boolean;
}) {
  const fmt = (v: number) =>
    asCurrency
      ? formatCurrency(v, currency)
      : new Intl.NumberFormat("es-ES").format(v);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="48%"
          outerRadius="72%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={chartTheme.colors[i % chartTheme.colors.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={chartTooltipStyle()}
          formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CompareLineChart({
  data,
  currency = "EUR",
}: {
  data: SeriesPoint[];
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} minTickGap={24} />
        <YAxis
          stroke={chartTheme.axis}
          fontSize={11}
          width={44}
          tickFormatter={(v) => String(Math.round(Number(v)))}
        />
        <Tooltip
          contentStyle={chartTooltipStyle()}
          formatter={(value, name) => [
            formatCurrency(Number(value ?? 0), currency),
            String(name),
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          name="Actual"
          stroke={chartTheme.colors[0]}
          strokeWidth={chartTheme.strokeWidth}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="secondary"
          name="Anterior"
          stroke={chartTheme.colors[2]}
          strokeWidth={chartTheme.strokeWidth}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
