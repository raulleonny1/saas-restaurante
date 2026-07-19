import { cn } from "@/lib/cn";
import { ReactNode } from "react";
import { Label } from "@/ui/atoms/Label";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Molecule — label + control + hint/error. Prefer over embedding labels in atoms
 * when composing custom controls.
 */
export function FormField({
  label,
  htmlFor,
  required,
  optional,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required} optional={optional}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? <span className="text-caption text-danger">{error}</span> : null}
      {!error && hint ? <span className="text-caption">{hint}</span> : null}
    </div>
  );
}
