"use client";

import { formatCurrency } from "@/lib/format";
import {
  activeOrderItems,
  formatElapsedShort,
} from "@/modules/pos/domain/orderPreview";
import { orderItemStatusLabel } from "@/modules/waiter/domain/itemStatus";
import type { Order, Table } from "@/types/orders";
import { Badge, Button, Modal } from "@/ui";

function itemWhen(item: { sentAt?: string }, order: Order): string {
  return formatElapsedShort(item.sentAt ?? order.sentAt ?? order.openedAt);
}

/**
 * Vista previa de la mesa sin entrar aún al ticket/pedido.
 * Usada por mesero (/waiter) y gerente (POS / sala).
 */
export function TableOrderPreviewModal({
  open,
  onClose,
  table,
  order,
  currency,
  tone = "default",
  onEnter,
}: {
  open: boolean;
  onClose: () => void;
  table: Table | null;
  order: Order | null;
  currency: string;
  tone?: "default" | "waiter";
  /** Entrar al pedido / ticket (después de la previa). */
  onEnter: () => void;
}) {
  if (!table) return null;

  const items = activeOrderItems(order);
  const waiter = tone === "waiter";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mesa ${table.name}`}
      description={
        order
          ? `Vista previa · abierto hace ${formatElapsedShort(order.openedAt) || "—"}`
          : "Vista previa · sin ticket abierto"
      }
      size="md"
      className={
        waiter
          ? "!border-white/15 !bg-[#121a14] !text-[#e7efe4] [&_h2]:!text-[#e7efe4] [&_p]:text-[#a8b5a4]"
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={onEnter}>
            {order ? "Entrar al pedido" : "Abrir / pedir"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {table.seats} asientos
            {table.zone ? ` · ${table.zone}` : ""}
          </span>
          {order ? (
            <Badge tone={waiter ? "success" : "accent"}>{order.status}</Badge>
          ) : (
            <Badge tone="neutral">Libre</Badge>
          )}
        </div>

        {!order || !items.length ? (
          <p
            className={`rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-center text-sm ${
              waiter
                ? "border-white/15 text-[#8fa08c]"
                : "border-border text-fg-muted"
            }`}
          >
            {order
              ? "Mesa abierta sin líneas todavía."
              : "Nadie ha pedido aún en esta mesa."}
          </p>
        ) : (
          <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-start justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                  item.status === "ready"
                    ? waiter
                      ? "border-cyan-400/50 bg-cyan-950/40"
                      : "border-cyan-500/40 bg-cyan-500/10"
                    : waiter
                      ? "border-white/10 bg-white/5"
                      : "border-border"
                }`}
              >
                <div className="min-w-0">
                  <p className={waiter ? "text-[#e7efe4]" : undefined}>
                    <span className="font-medium">{item.quantity}×</span>{" "}
                    {item.name}
                  </p>
                  <p
                    className={
                      item.status === "ready"
                        ? waiter
                          ? "text-[11px] font-medium text-cyan-300"
                          : "text-caption font-medium text-cyan-700"
                        : waiter
                          ? "text-[11px] text-[#8fa08c]"
                          : "text-caption text-fg-muted"
                    }
                  >
                    {orderItemStatusLabel(item.status)}
                    {itemWhen(item, order)
                      ? ` · hace ${itemWhen(item, order)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 ${waiter ? "text-[#c5d0c2]" : "text-fg-muted"}`}
                >
                  {formatCurrency(item.unitPrice * item.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {order ? (
          <div
            className={`flex items-center justify-between border-t pt-3 text-sm font-medium ${
              waiter ? "border-white/10 text-[#e7efe4]" : "border-border"
            }`}
          >
            <span>Total</span>
            <span>{formatCurrency(order.total, currency)}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
