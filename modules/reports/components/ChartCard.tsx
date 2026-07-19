"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/ui";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  description,
  children,
  empty,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  empty?: boolean;
  className?: string;
}) {
  return (
    <Card padding="md" className={className}>
      <CardHeader className="mb-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      {empty ? (
        <div className="flex h-56 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-bg-muted/40 px-4 text-center text-sm text-fg-muted">
          Sin datos en el periodo seleccionado.
        </div>
      ) : (
        <div className="h-56 w-full min-w-0 sm:h-64 lg:h-72">{children}</div>
      )}
    </Card>
  );
}
