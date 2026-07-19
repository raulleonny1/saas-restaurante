import { cn } from "@/lib/cn";

/**
 * Atom — loading placeholder. Uses `bg-muted` so it works in light and dark.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-[var(--radius-md)] bg-bg-muted",
        className,
      )}
    />
  );
}
