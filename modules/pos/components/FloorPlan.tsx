"use client";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { TableOrderPreviewModal } from "@/modules/pos/components/TableOrderPreviewModal";
import {
  formatElapsedShort,
  orderPreviewLines,
} from "@/modules/pos/domain/orderPreview";
import {
  orderForTable,
  resolveTableFloorTone,
  TABLE_TONE_ADMIN,
  TABLE_TONE_LABEL,
  type TableFloorTone,
} from "@/modules/pos/domain/tableTone";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Table } from "@/types/orders";
import { Badge } from "@/ui";
import { useState } from "react";

const LEGEND: TableFloorTone[] = [
  "free",
  "occupied",
  "ordering",
  "sent",
  "ready",
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
    markTableClean,
  } = usePos();
  const [previewTable, setPreviewTable] = useState<Table | null>(null);

  if (!tables.length) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-muted/40 p-6 text-center text-sm text-fg-muted">
        No hay mesas en esta sucursal. Usa «Mesas» para crearlas con asientos, o
        «Preparar POS» para un plano de ejemplo.
      </div>
    );
  }

  const previewOrder = previewTable
    ? orderForTable(previewTable, openOrders)
    : null;

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
          const lines = orderPreviewLines(order, 3);
          const elapsed = order
            ? formatElapsedShort(order.openedAt)
            : "";
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => setPreviewTable(table)}
              className={cn(
                "flex min-h-[110px] flex-col items-start rounded-[var(--radius-lg)] border p-3 text-left transition-all duration-[var(--duration-fast)]",
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
              <p className="mt-0.5 text-caption">
                {table.seats} asientos
                {table.mergedWith?.length
                  ? ` · +${table.mergedWith.length}`
                  : ""}
                {elapsed ? ` · ${elapsed}` : ""}
              </p>
              {lines.length ? (
                <ul className="mt-1.5 w-full space-y-0.5">
                  {lines.map((line) => (
                    <li
                      key={line}
                      className="truncate text-[11px] leading-snug text-fg"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] text-fg-muted">Sin pedidos</p>
              )}
              <p className="mt-auto pt-1.5 text-sm font-medium">
                {order
                  ? formatCurrency(order.total, currency)
                  : "Sin ticket"}
              </p>
            </button>
          );
        })}
      </div>

      <TableOrderPreviewModal
        open={Boolean(previewTable)}
        onClose={() => setPreviewTable(null)}
        table={previewTable}
        order={previewOrder}
        currency={currency}
        onMarkClean={
          previewTable
            ? async () => {
                await markTableClean(previewTable.id);
              }
            : undefined
        }
        onEnter={() => {
          if (!previewTable) return;
          selectTable(previewTable.id);
          setPreviewTable(null);
        }}
      />
    </div>
  );
}
