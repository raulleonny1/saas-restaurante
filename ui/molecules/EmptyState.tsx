import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Molecule — empty list/panel placeholder with optional CTA slot.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-elevated/50 px-6 py-10 animate-fade-up">
      <h3 className="text-title">{title}</h3>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action}
    </div>
  );
}
