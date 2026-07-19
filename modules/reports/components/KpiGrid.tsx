"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface KpiItem {
  label: string;
  value: number;
  format?: "currency" | "number" | "percent" | "hours";
  delta?: number;
  currency?: string;
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-4 py-3"
        >
          <p className="text-caption text-fg-muted">{item.label}</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums text-fg">
            {formatKpi(item)}
          </p>
          {typeof item.delta === "number" ? (
            <p
              className={cn(
                "mt-1 text-caption tabular-nums",
                item.delta > 0
                  ? "text-success"
                  : item.delta < 0
                    ? "text-danger"
                    : "text-fg-muted",
              )}
            >
              {item.delta > 0 ? "+" : ""}
              {formatPercent(item.delta)} vs periodo anterior
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatKpi(item: KpiItem): string {
  switch (item.format) {
    case "currency":
      return formatCurrency(item.value, item.currency ?? "EUR");
    case "percent":
      return formatPercent(item.value);
    case "hours":
      return `${item.value.toFixed(1)} h`;
    default:
      return new Intl.NumberFormat("es-ES").format(item.value);
  }
}
