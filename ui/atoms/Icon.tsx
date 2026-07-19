import { cn } from "@/lib/cn";
import type { LucideIcon, LucideProps } from "lucide-react";

type IconSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<IconSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
};

interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
  size?: IconSize;
}

/** Lucide wrapper — stroke 1.75, currentColor, design-system sizes. */
export function Icon({ icon: Comp, size = "md", className, ...props }: IconProps) {
  return (
    <Comp
      className={cn(sizes[size], "shrink-0", className)}
      strokeWidth={1.75}
      {...props}
    />
  );
}
