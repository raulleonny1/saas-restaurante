"use client";

import { AutomationFormModal } from "@/modules/marketing/components/AutomationFormModal";
import { CHANNEL_LABELS } from "@/modules/marketing/domain/channels";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import { AUTOMATION_TRIGGER_LABELS } from "@/modules/marketing/services/automations.service";
import type { MarketingAutomation } from "@/types/promotions";
import { Badge, Button, EmptyState, toast } from "@/ui";
import { Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function AutomationsPanel() {
  const {
    automations,
    saveAutomation,
    removeAutomation,
    triggerAutomation,
  } = useMarketing();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingAutomation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Flujos automáticos por segmento (cumpleaños, riesgo, VIP…).
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      {!automations.length ? (
        <EmptyState
          title="Sin automatizaciones"
          description="Configura disparadores que crean y envían campañas solas."
        />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-bg-elevated">
          {automations.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{a.name}</span>
                  <Badge tone={a.enabled ? "success" : "neutral"}>
                    {a.enabled ? "Activa" : "Pausada"}
                  </Badge>
                  <Badge tone="accent">
                    {AUTOMATION_TRIGGER_LABELS[a.trigger]}
                  </Badge>
                  <Badge tone="neutral">{CHANNEL_LABELS[a.channel]}</Badge>
                </div>
                <p className="text-sm text-fg-muted line-clamp-2">{a.body}</p>
                <p className="text-caption text-fg-muted">
                  Cooldown {a.cooldownDays}d
                  {a.lastRunAt
                    ? ` · Última: ${new Date(a.lastRunAt).toLocaleString("es")}`
                    : " · Sin ejecuciones"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === a.id}
                  onClick={() => {
                    void (async () => {
                      try {
                        setBusyId(a.id);
                        const n = await triggerAutomation(a);
                        toast(
                          n
                            ? `Automatización: ${n} contactos`
                            : "Sin contactos elegibles",
                          n ? "success" : "info",
                        );
                      } catch (e) {
                        toast(
                          e instanceof Error ? e.message : "Error",
                          "error",
                        );
                      } finally {
                        setBusyId(null);
                      }
                    })();
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> Ejecutar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void removeAutomation(a.id).then(() =>
                      toast("Automatización eliminada", "info"),
                    );
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AutomationFormModal
        open={open}
        onClose={() => setOpen(false)}
        automation={editing}
        onSubmit={async (payload) => {
          await saveAutomation({ automation: editing, ...payload });
          toast("Automatización guardada", "success");
        }}
      />
    </div>
  );
}
