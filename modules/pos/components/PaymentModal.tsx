"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { PaymentMethod } from "@/types/orders";
import { Button, Input, Modal, toast } from "@/ui";
import { useEffect, useState } from "react";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "stripe", label: "Stripe" },
  { id: "sumup", label: "SumUp" },
  { id: "other", label: "Otro" },
];

export function PaymentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { balance, currency, pay, activeOrder, printReceipt } = usePos();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState(String(balance));
  const [tipExtra, setTipExtra] = useState("0");
  const [splitSeat, setSplitSeat] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(String(balance));
      setTipExtra("0");
    }
  }, [open, balance]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cobrar"
      description={
        activeOrder
          ? `Pendiente ${formatCurrency(balance, currency)}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || balance <= 0}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await pay(
                    method,
                    Number(amount) || 0,
                    Number(tipExtra) || 0,
                    splitSeat,
                  );
                  toast("Pago registrado", "success");
                  try {
                    await printReceipt();
                  } catch {
                    /* print optional */
                  }
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Confirmar cobro
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`rounded-[var(--radius-md)] border px-3 py-3 text-sm font-medium ${
                method === m.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Input
          label="Importe"
          type="number"
          step="0.01"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Propina adicional (importe)"
          type="number"
          step="0.01"
          min={0}
          value={tipExtra}
          onChange={(e) => setTipExtra(e.target.value)}
        />
        {activeOrder?.splitParts && activeOrder.splitParts > 1 ? (
          <label className="block text-sm">
            <span className="mb-1 block text-fg-muted">Cobrar parte</span>
            <select
              className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3"
              value={splitSeat ?? ""}
              onChange={(e) =>
                setSplitSeat(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">Cuenta completa / restante</option>
              {Array.from({ length: activeOrder.splitParts }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Parte {i + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setAmount(String(balance))}
          >
            Exacto
          </Button>
          {[10, 20, 50].map((n) => (
            <Button
              key={n}
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setAmount(String(n))}
            >
              {formatCurrency(n, currency)}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
