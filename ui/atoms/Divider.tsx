import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  label?: string;
  orientation?: "horizontal" | "vertical";
}

/**
 * Atom — visual separator. Optional centered label on horizontal.
 */
export function Divider({
  className,
  label,
  orientation = "horizontal",
  ...props
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn("mx-2 w-px self-stretch bg-border", className)}
      />
    );
  }

  if (!label) {
    return (
      <hr
        className={cn("my-4 border-0 border-t border-border", className)}
        {...props}
      />
    );
  }

  return (
    <div className={cn("my-4 flex items-center gap-3", className)} role="separator">
      <div className="h-px flex-1 bg-border" />
      <span className="text-caption">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
