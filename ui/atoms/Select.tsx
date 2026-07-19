import { cn } from "@/lib/cn";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/**
 * Atom — native select styled with design tokens.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={id}>
      {label ? <span className="text-fg-muted">{label}</span> : null}
      <select
        ref={ref}
        id={id}
        className={cn(
          "h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 text-fg shadow-[var(--shadow-sm)]",
          "outline-none transition-[border,box-shadow] duration-[var(--duration-fast)]",
          "focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)]",
          error && "border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </label>
  ),
);
Select.displayName = "Select";
