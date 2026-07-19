import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

/**
 * Atom — keyboard shortcut badge.
 */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg-muted px-1.5 font-mono text-[10px] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
