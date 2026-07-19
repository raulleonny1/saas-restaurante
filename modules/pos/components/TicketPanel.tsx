"use client";

import { formatCurrency } from "@/lib/format";
import { lineTotal } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import { Button, IconButton, Input } from "@/ui";
import {
  Minus,
  Plus,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export function TicketPanel({
  onPay,
  onMove,
  onMerge,
  onSplit,
}: {
  onPay: () => void;
  onMove: () => void;
  onMerge: () => void;
  onSplit: () => void;
}) {
  const {
    selectedTableId,
    tables,
    activeOrder,
    openSelectedTable,
    setItemQty,
    setItemNotes,
    removeItem,
    setDiscount,
    setTip,
    sendKitchen,
    printReceipt,
    currency,
    balance,
    tipDefault,
  } = usePos();

  const table = tables.find((t) => t.id === selectedTableId);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);

  if (!selectedTableId || !table) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-muted/30 p-6 text-center text-sm text-fg-muted">
        Selecciona una mesa del plano para abrir o continuar un ticket.
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="flex h-full min-h-[280px] flex-col justify-between rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
        <div>
          <h2 className="text-title">Mesa {table.name}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {table.status === "available" || table.status === "dirty"
              ? "Sin pedido abierto"
              : "Cargando pedido…"}
          </p>
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={() => void openSelectedTable().catch((e) => alert(e.message))}
        >
          Abrir mesa
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-title">Ticket · {activeOrder.tableName}</h2>
            <p className="text-caption">
              #{activeOrder.id.slice(0, 8)} · {activeOrder.status}
              {activeOrder.mergedTableIds?.length
                ? ` · unida (${activeOrder.mergedTableIds.length})`
                : ""}
            </p>
          </div>
          {activeOrder.status === "paid" || balance <= 0.001 ? (
            <IconButton
              aria-label="Imprimir ticket cobrado"
              onClick={() => void printReceipt().catch((e) => alert(e.message))}
            >
              <Printer className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
        {!activeOrder.items.length ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            Añade productos desde la carta.
          </p>
        ) : (
          activeOrder.items.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-md)] border border-border/70 bg-bg-muted/40 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.name}
                    {item.variantName ? ` · ${item.variantName}` : ""}
                  </p>
                  {item.modifiers?.length ? (
                    <p className="text-caption">
                      {item.modifiers.map((m) => m.name).join(", ")}
                    </p>
                  ) : null}
                  {item.kitchenNotes ? (
                    <p className="text-caption text-warning">
                      Nota: {item.kitchenNotes}
                    </p>
                  ) : null}
                  {typeof item.splitSeat === "number" ? (
                    <p className="text-caption">Parte {item.splitSeat}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-medium">
                  {formatCurrency(lineTotal(item), currency)}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <IconButton
                  size="sm"
                  aria-label="Menos"
                  onClick={() =>
                    void setItemQty(item.id, item.quantity - 1)
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </IconButton>
                <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                <IconButton
                  size="sm"
                  aria-label="Más"
                  onClick={() =>
                    void setItemQty(item.id, item.quantity + 1)
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </IconButton>
                <button
                  type="button"
                  className="ml-2 text-caption text-accent hover:underline"
                  onClick={() =>
                    setNoteEditId(noteEditId === item.id ? null : item.id)
                  }
                >
                  Nota
                </button>
                <IconButton
                  size="sm"
                  variant="danger"
                  className="ml-auto"
                  aria-label="Eliminar"
                  onClick={() => void removeItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              {noteEditId === item.id ? (
                <input
                  className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-border bg-bg-elevated px-2 text-sm"
                  defaultValue={item.kitchenNotes ?? ""}
                  placeholder="Notas cocina"
                  onBlur={(e) =>
                    void setItemNotes(item.id, e.target.value.trim())
                  }
                />
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-border px-4 py-3 sm:px-5">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Desc %"
            type="number"
            min={0}
            max={100}
            defaultValue={activeOrder.discountPercent}
            onBlur={(e) =>
              void setDiscount(Number(e.target.value) || 0)
            }
          />
          <Input
            label={`Propina % (def. ${tipDefault})`}
            type="number"
            min={0}
            max={100}
            defaultValue={activeOrder.tipPercent}
            onBlur={(e) => void setTip(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={formatCurrency(activeOrder.subtotal, currency)} />
          <Row
            label="Descuento"
            value={`-${formatCurrency(activeOrder.discountAmount, currency)}`}
          />
          <Row label="IVA" value={formatCurrency(activeOrder.taxAmount, currency)} />
          <Row label="Propina" value={formatCurrency(activeOrder.tipAmount, currency)} />
          <Row
            label="Pagado"
            value={formatCurrency(activeOrder.amountPaid ?? 0, currency)}
          />
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(activeOrder.total, currency)}</span>
          </div>
          <div className="flex justify-between text-accent">
            <span>Pendiente</span>
            <span>{formatCurrency(balance, currency)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void sendKitchen().catch((e) => alert(e.message))}
          >
            <Send className="h-3.5 w-3.5" /> Cocina
          </Button>
          <Button variant="secondary" size="sm" onClick={onMove}>
            Cambiar mesa
          </Button>
          <Button variant="secondary" size="sm" onClick={onMerge}>
            Unir mesas
          </Button>
          <Button variant="secondary" size="sm" onClick={onSplit}>
            Dividir
          </Button>
        </div>
        <Button className="w-full" size="lg" onClick={onPay} disabled={balance <= 0 && activeOrder.items.length === 0}>
          Cobrar
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-fg-muted">
      <span>{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
