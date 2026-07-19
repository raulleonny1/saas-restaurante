import { cn } from "@/lib/cn";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, LucideIcon } from "lucide-react";
import { HTMLAttributes } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { wrap: string; Icon: LucideIcon }> = {
  info: {
    wrap: "border-[color-mix(in_oklab,var(--info)_35%,var(--border))] bg-[var(--info-soft)] text-fg",
    Icon: Info,
  },
  success: {
    wrap: "border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[var(--success-soft)] text-fg",
    Icon: CheckCircle2,
  },
  warning: {
    wrap: "border-[color-mix(in_oklab,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] text-fg",
    Icon: AlertTriangle,
  },
  danger: {
    wrap: "border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] text-fg",
    Icon: AlertCircle,
  },
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  title?: string;
}

/**
 * Molecule — inline feedback banner (info/success/warning/danger).
 */
export function Alert({
  className,
  tone = "info",
  title,
  children,
  ...props
}: AlertProps) {
  const { wrap, Icon } = tones[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm animate-fade-up",
        wrap,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-fg-muted">{children}</div> : null}
      </div>
    </div>
  );
}
