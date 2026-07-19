import { cn } from "@/lib/cn";
import { LabelHTMLAttributes } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
}

/**
 * Atom — form label. Supports required/optional hints.
 * Theming: uses `--fg-muted` / `--danger`.
 */
export function Label({
  className,
  children,
  required,
  optional,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn("inline-flex items-center gap-1 text-sm text-fg-muted", className)}
      {...props}
    >
      <span>{children}</span>
      {required ? <span className="text-danger">*</span> : null}
      {optional ? <span className="text-caption">(opcional)</span> : null}
    </label>
  );
}
