import type { AiInsight } from "@/types/ai";
import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/ui";
import Link from "next/link";

/**
 * Compact AI surface — insights reales de Firestore (aiInsights).
 */
export function AiPulse({ insights }: { insights: AiInsight[] }) {
  const top = insights.slice(0, 3);

  return (
    <Card padding="md">
      <CardHeader className="mb-3 sm:mb-4">
        <div className="min-w-0">
          <CardTitle>Pulso IA</CardTitle>
          <CardDescription>
            Insights generados para este restaurante
          </CardDescription>
        </div>
        <Badge tone="accent">{insights.length} nuevos</Badge>
      </CardHeader>

      {top.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin insights para esta sucursal.</p>
      ) : (
        <ol className="space-y-3">
          {top.map((insight, index) => (
            <li
              key={insight.id}
              className="flex gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">
                  {insight.summary}
                </p>
                <p className="mt-1 text-caption">
                  Confianza {(insight.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        <Link href="/ai" className="text-sm text-accent hover:underline">
          Abrir inbox IA
        </Link>
      </div>
    </Card>
  );
}
