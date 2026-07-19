"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import { Button, Modal, Select, toast } from "@/ui";
import { useState } from "react";

export function SplitBillModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { activeOrder, applySplit, assignItemSeat, currency } = usePos();
  const [parts, setParts] = useState(2);
  const [busy, setBusy] = useState(false);

  if (!activeOrder) return null;

  const equalShare = activeOrder.total / Math.max(parts, 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dividir cuenta"
      description="Define partes iguales y asigna líneas a cada asiento."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await applySplit(parts);
                  toast("División configurada", "success");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Aplicar {parts} partes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-fg-muted">Número de partes</span>
            <input
              type="number"
              min={2}
              max={12}
              value={parts}
              onChange={(e) => setParts(Number(e.target.value) || 2)}
              className="h-10 w-24 rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3"
            />
          </label>
          <p className="text-sm text-fg-muted">
            ~{formatCurrency(equalShare, currency)} por parte (orientativo)
          </p>
        </div>

        <div className="space-y-2">
          {activeOrder.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
            >
              <span className="text-sm">
                {item.quantity}× {item.name}
              </span>
              <Select
                className="min-w-[140px]"
                value={String(item.splitSeat ?? "")}
                onChange={(e) => {
                  const seat = Number(e.target.value);
                  if (!seat) return;
                  void assignItemSeat(item.id, seat).catch((err) =>
                    toast(err.message, "error"),
                  );
                }}
              >
                <option value="">Sin asignar</option>
                {Array.from({ length: parts }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Parte {i + 1}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
