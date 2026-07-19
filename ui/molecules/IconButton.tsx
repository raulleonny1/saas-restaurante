import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "ghost" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Required for a11y when the button has no visible text. */
  "aria-label": string;
}

const variants: Record<Variant, string> = {
  ghost: "bg-transparent text-fg-muted hover:bg-bg-muted hover:text-fg",
  secondary:
    "bg-bg-elevated text-fg border border-border shadow-[var(--shadow-sm)] hover:bg-bg-muted",
  danger: "bg-[var(--danger-soft)] text-danger hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 w-8 rounded-[var(--radius-sm)]",
  md: "h-10 w-10 rounded-[var(--radius-md)]",
  lg: "h-11 w-11 rounded-[var(--radius-md)]",
};

/**
 * Molecule — square icon-only button. Pass a Lucide icon as children.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-[var(--duration-fast)]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
