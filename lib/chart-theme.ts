import type { CSSProperties } from "react";

/**
 * Recharts / chart styling aligned with the design system.
 * CSS vars follow light/dark theme automatically.
 */

export const chartTheme = {
  colors: [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ],
  grid: "var(--border)",
  axis: "var(--fg-muted)",
  tooltip: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--fg)",
    boxShadow: "var(--shadow-md)",
  },
  areaGradientId: "ssArea",
  strokeWidth: 2,
} as const;

export function chartTooltipStyle(): CSSProperties {
  return {
    background: chartTheme.tooltip.background,
    border: chartTheme.tooltip.border,
    borderRadius: chartTheme.tooltip.borderRadius,
    color: chartTheme.tooltip.color,
    boxShadow: chartTheme.tooltip.boxShadow,
  };
}
