"use client";

import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import type { KitchenColumnId } from "@/types/kitchen";
import { KitchenTicketCard } from "./KitchenTicketCard";

const COLUMNS: { id: KitchenColumnId; title: string }[] = [
  { id: "queued", title: "Pedidos" },
  { id: "preparing", title: "Preparando" },
  { id: "ready", title: "Listo" },
  { id: "delivered", title: "Entregado" },
];

export function KitchenBoard() {
  const { ticketsByColumn, filters } = useKitchen();

  const visible = filters.includeDelivered
    ? COLUMNS
    : COLUMNS.filter((c) => c.id !== "delivered");

  return (
    <div
      className={`grid min-h-0 flex-1 gap-3 ${
        visible.length === 4
          ? "lg:grid-cols-4"
          : "lg:grid-cols-3"
      } grid-cols-1 sm:grid-cols-2`}
    >
      {visible.map((col) => {
        const list = ticketsByColumn[col.id];
        return (
          <section
            key={col.id}
            className="flex min-h-[280px] flex-col rounded-[var(--radius-xl)] border border-border bg-bg-muted/30"
          >
            <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h2 className="text-sm font-medium">{col.title}</h2>
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-caption">
                {list.length}
              </span>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-2.5">
              {!list.length ? (
                <p className="px-2 py-8 text-center text-sm text-fg-muted">
                  Vacío
                </p>
              ) : (
                list.map((ticket) => (
                  <KitchenTicketCard
                    key={`${ticket.order.id}-${col.id}-${ticket.items.map((i) => i.item.id).join("_")}`}
                    ticket={ticket}
                    column={col.id}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
