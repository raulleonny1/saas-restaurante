"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { formatTime } from "@/modules/reservations/domain/time";
import { useReservations } from "@/modules/reservations/context/ReservationsProvider";
import {
  buildGoogleCalendarAddUrl,
  connectGoogleCalendarPopup,
  downloadReservationIcs,
  getGoogleClientId,
  getStoredGoogleAccessToken,
  syncReservationToGoogleCalendar,
} from "@/modules/reservations/services/google-calendar.service";
import type { Reservation } from "@/types/reservations";
import { Badge, Button, toast } from "@/ui";
import { CalendarPlus, Download } from "lucide-react";
import { useState } from "react";

export function ReservationActionsList() {
  const {
    dayReservations,
    confirmReservation,
    sendReminder,
    runAutoAssign,
    setStatus,
    restaurantName,
  } = useReservations();
  const { restaurantId } = useRestaurant();
  const [gcalBusy, setGcalBusy] = useState(false);

  const syncGcal = async (r: Reservation) => {
    if (!restaurantId) return;
    try {
      setGcalBusy(true);
      let token = getStoredGoogleAccessToken();
      if (!token && getGoogleClientId()) {
        token = await connectGoogleCalendarPopup();
      }
      if (token) {
        await syncReservationToGoogleCalendar({
          restaurantId,
          reservation: r,
          restaurantName,
          accessToken: token,
        });
        toast("Sincronizado con Google Calendar", "success");
      } else {
        window.open(
          buildGoogleCalendarAddUrl(r, restaurantName),
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (e) {
      // Fallback: open template URL
      window.open(
        buildGoogleCalendarAddUrl(r, restaurantName),
        "_blank",
        "noopener,noreferrer",
      );
      toast(
        e instanceof Error
          ? `${e.message} — abierto enlace de Google Calendar`
          : "Abierto en Google Calendar",
        "info",
      );
    } finally {
      setGcalBusy(false);
    }
  };

  if (!dayReservations.length) {
    return (
      <p className="text-sm text-fg-muted">
        No hay reservas este día. Crea una en el formulario.
      </p>
    );
  }

  return (
    <ul className="max-h-[480px] space-y-2 overflow-y-auto">
      {dayReservations.map((r) => (
        <li
          key={r.id}
          className="rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{r.customerName}</p>
              <p className="text-caption">
                {formatTime(r.startsAt)} · {r.partySize} pax ·{" "}
                {r.tableName ?? "sin mesa"}
                {r.assignedAutomatically ? " · auto" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone="neutral">{r.status}</Badge>
              {r.confirmationSent ? (
                <Badge tone="success">Confirmada</Badge>
              ) : null}
              {r.reminderSent ? <Badge tone="accent">Recordatorio</Badge> : null}
              {r.googleEventId ? <Badge tone="info">GCal</Badge> : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.status === "pending" ? (
              <Button
                size="sm"
                onClick={() =>
                  void confirmReservation(r)
                    .then(() => toast("Confirmación enviada", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Confirmar
              </Button>
            ) : null}
            {!r.reminderSent && ["pending", "confirmed"].includes(r.status) ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void sendReminder(r)
                    .then(() => toast("Recordatorio registrado", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Recordatorio
              </Button>
            ) : null}
            {!r.tableId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void runAutoAssign(r)
                    .then(() => toast("Mesa autoasignada", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Auto-mesa
              </Button>
            ) : null}
            {r.status === "confirmed" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void setStatus(r, "seated")
                    .then(() => toast("Sentados", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Sentar
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={gcalBusy}
              onClick={() => void syncGcal(r)}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Google
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => downloadReservationIcs(r, restaurantName)}
            >
              <Download className="h-3.5 w-3.5" /> ICS
            </Button>
            {r.status !== "cancelled" ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void setStatus(r, "cancelled")
                    .then(() => toast("Cancelada", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
