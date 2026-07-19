import { cn } from "@/lib/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Atom — text input with optional label, hint, and error.
 * Surfaces: `bg-elevated` / `border` / focus `ring` tokens.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={id}>
      {label ? <span className="text-fg-muted">{label}</span> : null}
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 text-fg shadow-[var(--shadow-sm)]",
          "outline-none transition-[border,box-shadow] duration-[var(--duration-fast)]",
          "placeholder:text-fg-muted/70",
          "focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-danger focus:border-danger focus:shadow-[0_0_0_4px_var(--danger-soft)]",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-caption text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-caption">{hint}</span> : null}
    </label>
  ),
);
Input.displayName = "Input";
