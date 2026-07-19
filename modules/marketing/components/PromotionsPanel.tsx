"use client";

import { PromotionFormModal } from "@/modules/marketing/components/PromotionFormModal";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import type { Promotion } from "@/types/promotions";
import { Badge, Button, EmptyState, toast } from "@/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const STATUS_TONE: Record<
  Promotion["status"],
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  scheduled: "accent",
  active: "success",
  expired: "warning",
  disabled: "danger",
};

export function PromotionsPanel() {
  const { promotions, savePromotion, removePromotion } = useMarketing();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Ofertas de menú, happy hour y promos por segmento.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nueva promo
        </Button>
      </div>

      {!promotions.length ? (
        <EmptyState
          title="Sin promociones"
          description="Define descuentos y ventanas de vigencia."
        />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-bg-elevated">
          {promotions.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{p.name}</span>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  <Badge tone="neutral">{p.type}</Badge>
                </div>
                <p className="text-sm text-fg-muted">
                  {p.percentOff != null
                    ? `${p.percentOff}%`
                    : p.amountOff != null
                      ? `${p.amountOff.toFixed(2)} €`
                      : "—"}
                  {" · "}
                  {new Date(p.startsAt).toLocaleDateString("es")} →{" "}
                  {new Date(p.endsAt).toLocaleDateString("es")}
                  {" · "}
                  Usos {p.usageCount}
                  {p.usageLimit != null ? ` / ${p.usageLimit}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void removePromotion(p.id).then(() =>
                      toast("Promoción eliminada", "info"),
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

      <PromotionFormModal
        open={open}
        onClose={() => setOpen(false)}
        promotion={editing}
        onSubmit={async (payload) => {
          await savePromotion({ promotion: editing, ...payload });
          toast("Promoción guardada", "success");
        }}
      />
    </div>
  );
}
