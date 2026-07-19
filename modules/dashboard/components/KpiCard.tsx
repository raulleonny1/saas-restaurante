import { cn } from "@/lib/cn";
import { Card, Icon } from "@/ui";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  /** Percent vs yesterday; positive = up. */
  deltaPct?: number;
  icon: LucideIcon;
  className?: string;
}

/**
 * Dashboard KPI tile — uses design-system Card tokens (light/dark).
 */
export function KpiCard({
  label,
  value,
  hint,
  deltaPct,
  icon,
  className,
}: KpiCardProps) {
  return (
    <Card
      interactive
      padding="md"
      className={cn("min-h-[7.5rem] sm:min-h-[8.25rem]", className)}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="text-xs text-fg-muted sm:text-sm">{label}</p>
        <span className="shrink-0 rounded-[var(--radius-sm)] bg-accent-soft p-1.5 text-accent sm:p-2">
          <Icon icon={icon} size="md" />
        </span>
      </div>
      <p className="mt-2 text-[1.5rem] font-medium tracking-tight text-fg sm:mt-3 sm:text-[1.75rem]">
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {typeof deltaPct === "number" ? (
          <span
            className={cn(
              "text-caption font-medium",
              deltaPct >= 0 ? "text-success" : "text-danger",
            )}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% vs ayer
          </span>
        ) : null}
        {hint ? <p className="text-caption">{hint}</p> : null}
      </div>
    </Card>
  );
}
