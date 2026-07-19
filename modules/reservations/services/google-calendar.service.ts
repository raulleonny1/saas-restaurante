/**
 * Google Calendar integration for reservations.
 *
 * - Always available: "Add to Google Calendar" URL + ICS download (no OAuth).
 * - Optional API sync: uses OAuth access token from session + Calendar API v3
 *   when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured.
 */

import { formatSlot } from "@/modules/reservations/domain/time";
import type { Reservation } from "@/types/reservations";
import { getDb } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { nowIso } from "@/modules/reservations/domain/ids";

const TOKEN_KEY = "smartserve_gcal_access_token";
const CAL_ID_KEY = "smartserve_gcal_calendar_id";

export function getGoogleClientId(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
}

export function getStoredGoogleAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredGoogleAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getStoredCalendarId(): string {
  if (typeof window === "undefined") return "primary";
  return localStorage.getItem(CAL_ID_KEY) || "primary";
}

export function setStoredCalendarId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CAL_ID_KEY, id);
}

function toGCalDate(iso: string): string {
  // YYYYMMDDTHHmmssZ
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function buildGoogleCalendarAddUrl(
  reservation: Reservation,
  restaurantName: string,
): string {
  const title = encodeURIComponent(
    `Reserva ${reservation.customerName} · ${restaurantName}`,
  );
  const details = encodeURIComponent(
    [
      `${reservation.partySize} comensales`,
      reservation.tableName ? `Mesa ${reservation.tableName}` : null,
      reservation.customerPhone,
      reservation.customerEmail,
      reservation.notes,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const dates = `${toGCalDate(reservation.startsAt)}/${toGCalDate(reservation.endsAt)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

export function buildReservationIcs(
  reservation: Reservation,
  restaurantName: string,
): string {
  const uid = `${reservation.id}@smartserve`;
  const stamp = toGCalDate(new Date().toISOString());
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const desc = escape(
    `${reservation.partySize} pax · ${reservation.tableName ?? "sin mesa"} · ${formatSlot(reservation.startsAt)}`,
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartServe//Reservations//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toGCalDate(reservation.startsAt)}`,
    `DTEND:${toGCalDate(reservation.endsAt)}`,
    `SUMMARY:${escape(`Reserva ${reservation.customerName} · ${restaurantName}`)}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadReservationIcs(
  reservation: Reservation,
  restaurantName: string,
) {
  const ics = buildReservationIcs(reservation, restaurantName);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reserva-${reservation.id.slice(0, 8)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Starts Google OAuth code flow (implicit token) when client id is set.
 */
export function connectGoogleCalendarPopup(): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return Promise.reject(
      new Error(
        "Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID para sincronización API. Mientras, usa «Abrir en Google Calendar» o ICS.",
      ),
    );
  }

  const redirectUri = window.location.origin + "/reservations";
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/calendar.events",
  );
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token&scope=${scope}&include_granted_scopes=true&prompt=consent`;

  return new Promise((resolve, reject) => {
    const popup = window.open(url, "gcal_oauth", "width=520,height=640");
    if (!popup) {
      reject(new Error("Popup bloqueado"));
      return;
    }
    const timer = window.setInterval(() => {
      try {
        if (popup.closed) {
          window.clearInterval(timer);
          reject(new Error("Conexión cancelada"));
          return;
        }
        const href = popup.location.href;
        if (href.startsWith(redirectUri) && href.includes("access_token=")) {
          const hash = new URL(href).hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const token = params.get("access_token");
          popup.close();
          window.clearInterval(timer);
          if (token) {
            setStoredGoogleAccessToken(token);
            resolve(token);
          } else reject(new Error("Sin access_token"));
        }
      } catch {
        // cross-origin until redirect returns
      }
    }, 400);
  });
}

export async function syncReservationToGoogleCalendar(input: {
  restaurantId: string;
  reservation: Reservation;
  restaurantName: string;
  accessToken?: string;
}): Promise<string> {
  const token = input.accessToken || getStoredGoogleAccessToken();
  if (!token) {
    throw new Error("Conecta Google Calendar primero");
  }
  const calendarId = encodeURIComponent(getStoredCalendarId());
  const body = {
    summary: `Reserva ${input.reservation.customerName} · ${input.restaurantName}`,
    description: [
      `${input.reservation.partySize} comensales`,
      input.reservation.tableName
        ? `Mesa ${input.reservation.tableName}`
        : null,
      input.reservation.customerPhone,
      input.reservation.customerEmail,
      input.reservation.notes,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: input.reservation.startsAt },
    end: { dateTime: input.reservation.endsAt },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar: ${res.status} ${err.slice(0, 180)}`);
  }

  const data = (await res.json()) as { id: string };
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "reservations",
      input.reservation.id,
    ),
    {
      googleEventId: data.id,
      googleCalendarSyncedAt: nowIso(),
      updatedAt: nowIso(),
    },
  );
  return data.id;
}
