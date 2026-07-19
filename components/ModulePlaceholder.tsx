interface ModulePlaceholderProps {
  title: string;
  description: string;
  modulePath: string;
}

/** Empty shell for modules not yet implemented. */
export function ModulePlaceholder({
  title,
  description,
  modulePath,
}: ModulePlaceholderProps) {
  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted md:text-base">{description}</p>
      <div className="mt-10 rounded-[20px] border border-dashed border-border bg-bg-elevated/60 px-6 py-12">
        <p className="text-sm text-fg-muted">
          Módulo preparado. Implementa la lógica en{" "}
          <code className="text-fg">{modulePath}</code>
        </p>
      </div>
    </div>
  );
}
