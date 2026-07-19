"use client";

import { CouponFormModal } from "@/modules/marketing/components/CouponFormModal";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import type { Coupon } from "@/types/promotions";
import { Badge, Button, EmptyState, toast } from "@/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function CouponsPanel() {
  const { coupons, saveCoupon, removeCoupon } = useMarketing();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Códigos de descuento reutilizables o de un solo uso.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nuevo cupón
        </Button>
      </div>

      {!coupons.length ? (
        <EmptyState
          title="Sin cupones"
          description="Genera códigos para campañas o el POS."
        />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-bg-elevated">
          {coupons.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-semibold tracking-wide text-fg">
                    {c.code}
                  </span>
                  <Badge tone={c.active ? "success" : "neutral"}>
                    {c.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-sm text-fg-muted">
                  {c.discountPercent != null
                    ? `${c.discountPercent}%`
                    : c.discountAmount != null
                      ? `${c.discountAmount.toFixed(2)} €`
                      : "Sin descuento"}
                  {" · "}
                  Usos {c.usageCount}
                  {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  {c.expiresAt
                    ? ` · Caduca ${new Date(c.expiresAt).toLocaleDateString("es")}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
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
                    void removeCoupon(c.id).then(() =>
                      toast("Cupón eliminado", "info"),
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

      <CouponFormModal
        open={open}
        onClose={() => setOpen(false)}
        coupon={editing}
        onSubmit={async (payload) => {
          await saveCoupon({ coupon: editing, ...payload });
          toast("Cupón guardado", "success");
        }}
      />
    </div>
  );
}
