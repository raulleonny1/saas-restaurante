import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

/**
 * Molecule helper — caption under a control (hint or error tone).
 */
export function FieldHint({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { tone?: "muted" | "danger" }) {
  return (
    <p
      className={cn(
        "text-caption",
        tone === "danger" ? "text-danger" : "text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
