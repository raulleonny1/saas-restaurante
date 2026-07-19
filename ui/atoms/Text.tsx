import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

type Variant = "body" | "muted" | "caption" | "title" | "display" | "display-xl";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3";
}

const variants: Record<Variant, string> = {
  body: "text-sm text-fg",
  muted: "text-sm text-fg-muted",
  caption: "text-caption",
  title: "text-title",
  display: "text-display",
  "display-xl": "text-display-xl",
};

/**
 * Atom — typographic primitive mapped to design tokens.
 */
export function Text({
  variant = "body",
  as: Comp = "p",
  className,
  ...props
}: TextProps) {
  return <Comp className={cn(variants[variant], className)} {...props} />;
}
