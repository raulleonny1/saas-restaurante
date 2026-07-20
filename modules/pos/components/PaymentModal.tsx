"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { openCashDrawer } from "@/modules/pos/domain/cash-drawer";
import { roundMoney } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { PaymentMethod } from "@/types/orders";
import { Button, Input, Modal, toast } from "@/ui";
import { useEffect, useMemo, useState } from "react";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "stripe", label: "Stripe" },
  { id: "sumup", label: "SumUp" },
  { id: "other", label: "Otro" },
];

const CASH_CHIPS = [5, 10, 20, 50, 100];

export function PaymentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { restaurantId, restaurant } = useRestaurant();
  const { balance, currency, pay, activeOrder, printReceipt, payments } =
    usePos();
  const tpvPrinter = getEffectivePrintSettings(
    restaurantId,
    restaurant?.settings,
  ).printers.tpv;
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState(String(balance));
  const [tipExtra, setTipExtra] = useState("0");
  const [splitSeat, setSplitSeat] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  const tipNum = Number(tipExtra) || 0;
  const totalDue = roundMoney(balance + tipNum);
  const tenderedNum = Number(tendered) || 0;
  const change = useMemo(() => {
    if (method !== "cash") return 0;
    return roundMoney(Math.max(0, tenderedNum - totalDue));
  }, [method, tenderedNum, totalDue]);
  const cashOk =
    method !== "cash" || tenderedNum + 0.001 >= totalDue;

  useEffect(() => {
    if (open) {
      setTendered(String(balance));
      setTipExtra("0");
      setMethod("cash");
    }
  }, [open, balance]);

  const recentCash = payments
    .filter((p) => p.method === "cash" && p.changeGiven != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

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
            disabled={busy || balance <= 0 || !cashOk}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await pay(
                    method,
                    balance,
                    tipNum,
                    splitSeat,
                    method === "cash" ? tenderedNum : undefined,
                    { chargedFrom: "pos" },
                  );
                  if (method === "cash") {
                    void openCashDrawer(tpvPrinter).catch(() => {});
                  }
                  if (method === "cash" && change > 0) {
                    toast(
                      `Pago OK · cambio ${formatCurrency(change, currency)}`,
                      "success",
                    );
                  } else if (method === "stripe" || method === "sumup" || method === "card") {
                    toast("Pago con pasarela registrado", "success");
                  } else {
                    toast("Pago registrado", "success");
                  }
                  // Ticket solo tras cobro (el pedido ya quedó pagado)
                  try {
                    await printReceipt();
                  } catch {
                    /* si la mesa ya cerró, reimprimir desde historial */
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
            {method === "cash"
              ? `Cobrar · cambio ${formatCurrency(change, currency)}`
              : "Confirmar cobro"}
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
              onClick={() => {
                setMethod(m.id);
                if (m.id === "cash") setTendered(String(balance));
              }}
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
          label="Propina adicional"
          type="number"
          step="0.01"
          min={0}
          value={tipExtra}
          onChange={(e) => setTipExtra(e.target.value)}
        />

        {method === "cash" ? (
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-bg-muted/40 p-3">
            <Input
              label="Cliente entrega"
              type="number"
              step="0.01"
              min={0}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => setTendered(String(totalDue))}
              >
                Exacto
              </Button>
              {CASH_CHIPS.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setTendered(String(n))}
                >
                  {formatCurrency(n, currency)}
                </Button>
              ))}
            </div>
            <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-4 py-3 text-center">
              <p className="text-caption text-fg-muted">Cambio a devolver</p>
              <p className="text-3xl font-semibold text-accent tabular-nums">
                {formatCurrency(cashOk ? change : 0, currency)}
              </p>
              {!cashOk ? (
                <p className="mt-1 text-caption text-warning">
                  Falta{" "}
                  {formatCurrency(
                    roundMoney(totalDue - tenderedNum),
                    currency,
                  )}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Cobro de {formatCurrency(totalDue, currency)} con {method}.
          </p>
        )}

        {activeOrder?.splitParts && activeOrder.splitParts > 1 ? (
          <label className="block text-sm">
            <span className="mb-1 block text-fg-muted">Cobrar parte</span>
            <select
              className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3"
              value={splitSeat ?? ""}
              onChange={(e) =>
                setSplitSeat(
                  e.target.value ? Number(e.target.value) : undefined,
                )
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

        {recentCash.length ? (
          <div className="space-y-1.5">
            <p className="text-caption text-fg-muted">
              Últimos cambios (sala / caja · tiempo real)
            </p>
            {recentCash.map((p) => (
              <p key={p.id} className="text-sm">
                Entregó {formatCurrency(p.amountTendered ?? 0, currency)} →
                cambio{" "}
                <span className="font-medium text-accent">
                  {formatCurrency(p.changeGiven ?? 0, currency)}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
