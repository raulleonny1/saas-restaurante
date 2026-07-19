import { cn } from "@/lib/cn";
import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/**
 * Atom — multi-line text field with optional label/error.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={id}>
      {label ? <span className="text-fg-muted">{label}</span> : null}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "min-h-24 w-full resize-y rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 py-2.5 text-fg shadow-[var(--shadow-sm)]",
          "outline-none transition-[border,box-shadow] duration-[var(--duration-fast)]",
          "placeholder:text-fg-muted/70",
          "focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)]",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </label>
  ),
);
Textarea.displayName = "Textarea";
