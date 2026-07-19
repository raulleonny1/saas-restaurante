"use client";

import { CHANNEL_LABELS } from "@/modules/marketing/domain/channels";
import { CampaignFormModal } from "@/modules/marketing/components/CampaignFormModal";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import type { Campaign } from "@/types/promotions";
import { Badge, Button, EmptyState, toast } from "@/ui";
import { Plus, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

const STATUS_TONE: Record<
  Campaign["status"],
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  scheduled: "accent",
  sending: "warning",
  sent: "success",
  cancelled: "neutral",
  failed: "danger",
};

export function CampaignsPanel() {
  const {
    campaigns,
    saveCampaign,
    launchCampaign,
    cancelCamp,
    removeCampaign,
  } = useMarketing();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Campañas por canal con segmentación y programación.
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

      {!campaigns.length ? (
        <EmptyState
          title="Sin campañas"
          description="Crea tu primera campaña de email, SMS, WhatsApp o push."
        />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-bg-elevated">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{c.name}</span>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  <Badge tone="neutral">{CHANNEL_LABELS[c.channel]}</Badge>
                </div>
                <p className="truncate text-sm text-fg-muted">{c.body}</p>
                {c.stats ? (
                  <p className="text-caption text-fg-muted">
                    Enviados {c.stats.sent} · Fallidos {c.stats.failed} ·
                    Omitidos {c.stats.skipped}
                  </p>
                ) : null}
                {c.scheduledAt && c.status === "scheduled" ? (
                  <p className="text-caption text-accent">
                    Programada: {new Date(c.scheduledAt).toLocaleString("es")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(c.status === "draft" || c.status === "scheduled") && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === c.id}
                    onClick={() => {
                      void (async () => {
                        try {
                          setBusyId(c.id);
                          await launchCampaign(c);
                          toast("Campaña enviada", "success");
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
                    <Send className="h-3.5 w-3.5" /> Enviar
                  </Button>
                )}
                {c.status === "scheduled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void cancelCamp(c.id).then(() =>
                        toast("Campaña cancelada", "info"),
                      );
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void removeCampaign(c.id).then(() =>
                      toast("Campaña eliminada", "info"),
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

      <CampaignFormModal
        open={open}
        onClose={() => setOpen(false)}
        campaign={editing}
        onSubmit={async (payload) => {
          const { sendNow, ...rest } = payload;
          const saved = await saveCampaign({
            campaign: editing,
            ...rest,
          });
          if (sendNow) {
            await launchCampaign(saved);
            toast("Campaña enviada", "success");
          } else {
            toast(
              rest.status === "scheduled"
                ? "Campaña programada"
                : "Campaña guardada",
              "success",
            );
          }
        }}
      />
    </div>
  );
}
