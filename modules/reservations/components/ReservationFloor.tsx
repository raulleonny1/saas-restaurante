"use client";

import { cn } from "@/lib/cn";
import { tableBusyInSlot } from "@/modules/reservations/domain/assignment";
import { addMinutes, fromLocalInputValue } from "@/modules/reservations/domain/time";
import { useReservations } from "@/modules/reservations/context/ReservationsProvider";
import { Badge } from "@/ui";

export function ReservationFloor({
  selectedTableId,
  onSelectTable,
}: {
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
}) {
  const { tables, reservations, slotStart, durationMinutes } = useReservations();
  const startsAt = fromLocalInputValue(slotStart);
  const endsAt = addMinutes(startsAt, durationMinutes);

  if (!tables.length) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        No hay mesas. Crea el plano desde el POS («Preparar POS»).
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg-muted">
          Plano · franja seleccionada
        </h3>
        <Badge tone="neutral">{tables.length} mesas</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {tables.map((table) => {
          const busy = tableBusyInSlot(
            table.id,
            reservations,
            startsAt,
            endsAt,
          );
          const selected = selectedTableId === table.id;
          return (
            <button
              key={table.id}
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                onSelectTable(selected ? null : table.id)
              }
              className={cn(
                "min-h-[84px] rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
                busy
                  ? "border-danger/40 bg-[var(--danger-soft)] opacity-80"
                  : "border-border bg-bg-muted/40 hover:border-accent/50",
                selected && !busy && "ring-2 ring-accent",
              )}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{table.name}</span>
                <span className="text-caption">{table.seats} pax</span>
              </div>
              <p className="mt-2 text-caption">
                {busy
                  ? `Ocupada · ${busy.customerName}`
                  : selected
                    ? "Seleccionada"
                    : "Libre"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
