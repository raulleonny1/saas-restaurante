import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-bg-muted text-fg-muted",
  success: "bg-[var(--success-soft)] text-success",
  warning: "bg-[var(--warning-soft)] text-warning",
  danger: "bg-[var(--danger-soft)] text-danger",
  accent: "bg-accent-soft text-accent",
  info: "bg-[var(--info-soft)] text-info",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/**
 * Atom — status/meta chip. Soft tone backgrounds adapt via CSS variables.
 */
export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
