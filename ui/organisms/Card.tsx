import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Interactive cards get hover border treatment. */
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Surface container. Prefer only when the block is a unit of work/interaction.
 */
export function Card({
  className,
  interactive = false,
  padding = "md",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-border bg-bg-elevated/90 shadow-[var(--shadow-sm)]",
        paddings[padding],
        interactive &&
          "transition-[border-color,transform,box-shadow] duration-[var(--duration-fast)] hover:border-accent/40 hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-title", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}
