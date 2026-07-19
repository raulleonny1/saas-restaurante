"use client";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Table, TableStatus } from "@/types/orders";
import { Badge } from "@/ui";

const statusTone: Record<
  TableStatus,
  { label: string; className: string }
> = {
  available: {
    label: "Libre",
    className: "border-border bg-bg-elevated hover:border-accent/50",
  },
  occupied: {
    label: "Ocupada",
    className: "border-accent/50 bg-accent-soft/40",
  },
  reserved: {
    label: "Reservada",
    className: "border-info/40 bg-[var(--info-soft)]",
  },
  dirty: {
    label: "Sucia",
    className: "border-warning/40 bg-[var(--warning-soft)]",
  },
};

function tableAmount(
  table: Table,
  openOrders: ReturnType<typeof usePos>["openOrders"],
) {
  const order =
    openOrders.find((o) => o.id === table.currentOrderId) ??
    openOrders.find((o) => o.tableId === table.id);
  return order?.total ?? 0;
}

export function FloorPlan() {
  const {
    tables,
    openOrders,
    selectedTableId,
    selectTable,
    currency,
  } = usePos();

  if (!tables.length) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-muted/40 p-6 text-center text-sm text-fg-muted">
        No hay mesas en esta sucursal. Usa «Preparar POS» para crear el plano en
        Firestore.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(statusTone) as TableStatus[]).map((s) => (
          <Badge key={s} tone="neutral">
            {statusTone[s].label}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const selected = table.id === selectedTableId;
          const amount = tableAmount(table, openOrders);
          const tone = statusTone[table.status];
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => selectTable(table.id)}
              className={cn(
                "flex min-h-[88px] flex-col items-start justify-between rounded-[var(--radius-lg)] border p-3 text-left transition-all duration-[var(--duration-fast)]",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
                tone.className,
                selected && "ring-2 ring-accent shadow-[var(--shadow-md)]",
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-base font-medium tracking-tight">
                  {table.name}
                </span>
                <span className="text-caption">{tone.label}</span>
              </div>
              <div className="mt-2 w-full">
                <p className="text-caption">
                  {table.seats} pax
                  {table.mergedWith?.length
                    ? ` · +${table.mergedWith.length}`
                    : ""}
                </p>
                {amount > 0 ? (
                  <p className="mt-0.5 text-sm font-medium">
                    {formatCurrency(amount, currency)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-fg-muted">—</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
