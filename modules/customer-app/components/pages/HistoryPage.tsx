"use client";

import {
  money,
  orderStatusLabel,
  reservationStatusLabel,
} from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";

export function CustomerHistoryPage() {
  const { orders, reservations, restaurant } = useCustomerApp();

  const timeline = [
    ...orders.map((o) => ({
      id: o.id,
      kind: "order" as const,
      at: o.openedAt || o.createdAt,
      title: `Pedido ···${o.id.slice(-6)}`,
      detail: `${orderStatusLabel(o.status)} · ${money(o.total, restaurant?.currency)} · ${o.items.length} ítems`,
    })),
    ...reservations.map((r) => ({
      id: r.id,
      kind: "reservation" as const,
      at: r.startsAt,
      title: `Reserva · ${r.partySize} pers.`,
      detail: `${reservationStatusLabel(r.status)} · ${new Date(r.startsAt).toLocaleString("es-ES")}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Historial
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Pedidos y reservas anteriores.
        </p>
      </div>

      <ul className="space-y-2">
        {timeline.map((e) => (
          <li
            key={`${e.kind}-${e.id}`}
            className="rounded-lg border border-white/10 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{e.title}</p>
              <span className="text-[10px] uppercase tracking-wide text-[#5a6b57]">
                {e.kind === "order" ? "Pedido" : "Reserva"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#a8b5a4]">{e.detail}</p>
          </li>
        ))}
        {!timeline.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            Todavía no hay actividad.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
