import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-[var(--shadow-sm)] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-bg-elevated text-fg border border-border shadow-[var(--shadow-sm)] hover:bg-bg-muted",
  ghost: "bg-transparent text-fg hover:bg-bg-muted",
  danger: "bg-danger text-white shadow-[var(--shadow-sm)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-[var(--radius-sm)]",
  md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
  lg: "h-11 px-5 text-sm rounded-[var(--radius-md)]",
};

/**
 * Atom — primary interactive control.
 * Variants use semantic tokens (`accent`, `danger`, surfaces) for light/dark.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background,opacity,filter] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
