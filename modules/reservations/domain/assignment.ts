import { overlaps } from "@/modules/reservations/domain/time";
import type { Reservation } from "@/types/reservations";
import type { Table } from "@/types/orders";

const BLOCKING: Reservation["status"][] = [
  "pending",
  "confirmed",
  "seated",
];

/**
 * Picks the smallest table that fits the party and has no overlapping booking.
 */
export function findBestTable(input: {
  tables: Table[];
  reservations: Reservation[];
  partySize: number;
  startsAt: string;
  endsAt: string;
  ignoreReservationId?: string;
}): Table | null {
  const candidates = input.tables
    .filter((t) => !t.deletedAt && t.seats >= input.partySize)
    .sort((a, b) => a.seats - b.seats || a.name.localeCompare(b.name, "es"));

  for (const table of candidates) {
    const conflict = input.reservations.some(
      (r) =>
        r.id !== input.ignoreReservationId &&
        !r.deletedAt &&
        r.tableId === table.id &&
        BLOCKING.includes(r.status) &&
        overlaps(r.startsAt, r.endsAt, input.startsAt, input.endsAt),
    );
    if (!conflict) return table;
  }
  return null;
}

export function tableBusyInSlot(
  tableId: string,
  reservations: Reservation[],
  startsAt: string,
  endsAt: string,
  ignoreReservationId?: string,
): Reservation | null {
  return (
    reservations.find(
      (r) =>
        r.id !== ignoreReservationId &&
        !r.deletedAt &&
        r.tableId === tableId &&
        BLOCKING.includes(r.status) &&
        overlaps(r.startsAt, r.endsAt, startsAt, endsAt),
    ) ?? null
  );
}
