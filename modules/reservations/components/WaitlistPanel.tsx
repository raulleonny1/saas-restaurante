"use client";

import { useReservations } from "@/modules/reservations/context/ReservationsProvider";
import { Badge, Button, EmptyState, toast } from "@/ui";

export function WaitlistPanel() {
  const { waitlist, bookFromWaitlist, removeWaitlist } = useReservations();

  if (!waitlist.length) {
    return (
      <EmptyState
        title="Lista de espera vacía"
        description="Cuando no haya mesa, añade clientes aquí y asígnalos al liberarse hueco."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {waitlist.map((w, index) => (
        <li
          key={w.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-sm"
        >
          <div>
            <p className="font-medium">
              #{index + 1} {w.customerName}
            </p>
            <p className="text-caption">
              {w.partySize} pax
              {w.customerPhone ? ` · ${w.customerPhone}` : ""}
              {w.notes ? ` · ${w.notes}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge tone="warning">{w.status}</Badge>
            <Button
              size="sm"
              onClick={() =>
                void bookFromWaitlist(w)
                  .then(() => toast("Reserva creada desde waitlist", "success"))
                  .catch((e) => toast(e.message, "error"))
              }
            >
              Asignar mesa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void removeWaitlist(w.id)
                  .then(() => toast("Eliminado", "success"))
                  .catch((e) => toast(e.message, "error"))
              }
            >
              Quitar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
