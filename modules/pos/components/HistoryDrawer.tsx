"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import { refundPayment, subscribePaymentsForOrder } from "@/modules/pos/services/payments.service";
import type { Payment } from "@/types/orders";
import { Badge, Button, Modal, toast } from "@/ui";
import { useEffect, useState } from "react";

export function HistoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { historyOrders, currency, taxPercent, tables } = usePos();
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const selected = historyOrders.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    if (!open || !restaurantId || !selectedId) {
      setPayments([]);
      return;
    }
    return subscribePaymentsForOrder(restaurantId, selectedId, setPayments);
  }, [open, restaurantId, selectedId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Historial POS"
      description="Pedidos pagados / cancelados (Firestore en tiempo real)."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {historyOrders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelectedId(o.id)}
                className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm ${
                  selectedId === o.id
                    ? "border-accent bg-accent-soft/40"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {o.tableName ?? "Sin mesa"}
                  </span>
                  <Badge
                    tone={
                      o.status === "paid"
                        ? "success"
                        : o.refundedAt
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {o.status}
                  </Badge>
                </div>
                <p className="text-caption">
                  {formatCurrency(o.total, currency)} ·{" "}
                  {new Date(o.updatedAt).toLocaleString("es-ES")}
                </p>
              </button>
            </li>
          ))}
          {!historyOrders.length ? (
            <p className="text-sm text-fg-muted">Sin historial aún.</p>
          ) : null}
        </ul>

        <div className="rounded-[var(--radius-md)] border border-border p-3">
          {!selected ? (
            <p className="text-sm text-fg-muted">Selecciona un pedido.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                #{selected.id.slice(0, 8)} · {selected.tableName}
              </p>
              <ul className="space-y-1 text-sm">
                {selected.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity}× {i.name}
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-caption">Pagos / reembolsos</p>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {p.method} · {p.status}
                    </span>
                    <span>{formatCurrency(p.amount, currency)}</span>
                    {p.status === "completed" && p.amount > 0 ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          void (async () => {
                            if (!restaurantId || !user) return;
                            try {
                              const table =
                                tables.find((t) => t.id === selected.tableId) ??
                                null;
                              await refundPayment({
                                restaurantId,
                                order: selected,
                                payment: p,
                                amount: p.amount,
                                uid: user.uid,
                                taxPercent,
                                reopenTable: table,
                              });
                              toast("Reembolso registrado", "success");
                            } catch (e) {
                              toast(
                                e instanceof Error ? e.message : "Error",
                                "error",
                              );
                            }
                          })();
                        }}
                      >
                        Reembolsar
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
