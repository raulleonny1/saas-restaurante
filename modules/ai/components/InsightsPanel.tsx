"use client";

import { useAi } from "@/modules/ai/context/AiProvider";
import { Badge, Button, EmptyState, toast } from "@/ui";
import { RefreshCw, X } from "lucide-react";

export function InsightsPanel() {
  const { insights, refreshInsights, dismiss, busy } = useAi();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Insights proactivos del gerente IA
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void (async () => {
              try {
                const n = await refreshInsights();
                toast(`${n} insights regenerados`, "success");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Error", "error");
              }
            })();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Analizar DB
        </Button>
      </div>

      {!insights.length ? (
        <EmptyState
          title="Sin insights"
          description="Pulsa «Analizar DB» para generar recomendaciones desde pedidos, stock, CRM y equipo."
        />
      ) : (
        <ul className="space-y-2">
          {insights.slice(0, 12).map((i) => (
            <li
              key={i.id}
              className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{i.title}</span>
                    <Badge tone="accent">{i.type}</Badge>
                    <Badge tone="neutral">
                      {Math.round(i.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-fg-muted">{i.summary}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Descartar"
                  onClick={() => {
                    void dismiss(i.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
