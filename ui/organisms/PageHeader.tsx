import { cn } from "@/lib/cn";
import { HTMLAttributes, ReactNode } from "react";

export interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}

/**
 * Organism — page chrome: title, description, optional actions.
 * Tokens: display typography + muted description for light/dark.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1.5">
        {breadcrumbs ? <div className="mb-1">{breadcrumbs}</div> : null}
        <h1 className="text-display">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
