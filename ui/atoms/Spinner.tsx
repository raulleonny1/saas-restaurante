import { cn } from "@/lib/cn";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizes = {
  sm: "h-3.5 w-3.5 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
};

/**
 * Atom — loading spinner. Respects `prefers-reduced-motion` via global CSS.
 */
export function Spinner({ size = "md", className, label = "Cargando" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-border border-t-accent",
        sizes[size],
        className,
      )}
    />
  );
}
