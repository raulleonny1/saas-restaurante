import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** `attached` shares borders; `spaced` keeps gap. */
  variant?: "attached" | "spaced";
}

/**
 * Molecule — groups related actions. Children should be `Button` atoms.
 */
export function ButtonGroup({
  className,
  variant = "spaced",
  ...props
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center",
        variant === "spaced" && "gap-2",
        variant === "attached" &&
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:-ml-px [&>*:not(:last-child)]:rounded-r-none",
        className,
      )}
      {...props}
    />
  );
}
