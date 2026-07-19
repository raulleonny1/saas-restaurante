"use client";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  orderForTable,
  resolveTableFloorTone,
  TABLE_TONE_ADMIN,
  TABLE_TONE_LABEL,
  type TableFloorTone,
} from "@/modules/pos/domain/tableTone";
import { usePos } from "@/modules/pos/context/PosProvider";
import { Badge } from "@/ui";

const LEGEND: TableFloorTone[] = [
  "free",
  "occupied",
  "ordering",
  "sent",
  "reserved",
  "dirty",
];

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
        No hay mesas en esta sucursal. Usa «Mesas» para crearlas con asientos, o
        «Preparar POS» para un plano de ejemplo.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        {LEGEND.map((tone) => (
          <Badge
            key={tone}
            tone="neutral"
            className={cn("border", TABLE_TONE_ADMIN[tone])}
          >
            {TABLE_TONE_LABEL[tone]}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const order = orderForTable(table, openOrders);
          const tone = resolveTableFloorTone(table, order);
          const selected = table.id === selectedTableId;
          const amount = order?.total ?? 0;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => selectTable(table.id)}
              className={cn(
                "flex min-h-[88px] flex-col items-start justify-between rounded-[var(--radius-lg)] border p-3 text-left transition-all duration-[var(--duration-fast)]",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]",
                TABLE_TONE_ADMIN[tone],
                selected && "ring-2 ring-accent shadow-[var(--shadow-md)]",
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-base font-medium tracking-tight">
                  {table.name}
                </span>
                <span className="text-caption">{TABLE_TONE_LABEL[tone]}</span>
              </div>
              <div className="mt-2 w-full">
                <p className="text-caption">
                  {table.seats} asientos
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
