"use client";

import { cn } from "@/lib/cn";
import { dayHours, formatTime } from "@/modules/reservations/domain/time";
import { useReservations } from "@/modules/reservations/context/ReservationsProvider";
import type { ReservationStatus } from "@/types/reservations";
import { Badge, Button } from "@/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_TONE: Record<
  ReservationStatus,
  "neutral" | "accent" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  confirmed: "accent",
  seated: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export function ReservationCalendar() {
  const {
    selectedDate,
    setSelectedDate,
    dayReservations,
    setSlotStart,
  } = useReservations();

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const hours = dayHours(10, 22);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <Button size="sm" variant="ghost" onClick={() => shiftDay(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium capitalize">
            {selectedDate.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <button
            type="button"
            className="text-caption text-accent hover:underline"
            onClick={() => setSelectedDate(new Date())}
          >
            Hoy
          </button>
        </div>
        <Button size="sm" variant="ghost" onClick={() => shiftDay(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {hours.map((h) => {
          const slotItems = dayReservations.filter(
            (r) => new Date(r.startsAt).getHours() === h,
          );
          return (
            <div
              key={h}
              className="grid grid-cols-[48px_1fr] gap-2 border-b border-border/60 py-2"
            >
              <button
                type="button"
                className="text-caption text-fg-muted hover:text-accent"
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setHours(h, 0, 0, 0);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setSlotStart(
                    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`,
                  );
                }}
              >
                {String(h).padStart(2, "0")}:00
              </button>
              <div className="min-h-[40px] space-y-1.5">
                {slotItems.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-[var(--radius-md)] border border-border bg-bg-muted/50 px-2.5 py-1.5 text-sm",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.customerName}</p>
                        <p className="text-caption">
                          {formatTime(r.startsAt)}–{formatTime(r.endsAt)} ·{" "}
                          {r.partySize} pax
                          {r.tableName ? ` · ${r.tableName}` : " · sin mesa"}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
