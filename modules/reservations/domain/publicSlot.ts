import type { Reservation, ReservationStatus } from "@/types/reservations";

/** Slot público sin datos personales (para disponibilidad web/app). */
export type PublicBookingSlot = {
  id: string;
  restaurantId: string;
  branchId: string;
  tableId?: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  updatedAt: string;
};

const BLOCKING: ReservationStatus[] = [
  "pending",
  "confirmed",
  "seated",
];

export function isBlockingReservationStatus(
  status: ReservationStatus,
): boolean {
  return BLOCKING.includes(status);
}

export function reservationToPublicSlot(
  r: Pick<
    Reservation,
    | "id"
    | "restaurantId"
    | "branchId"
    | "tableId"
    | "partySize"
    | "startsAt"
    | "endsAt"
    | "status"
  >,
  updatedAt: string,
): PublicBookingSlot {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    branchId: r.branchId,
    tableId: r.tableId ?? null,
    partySize: r.partySize,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    updatedAt,
  };
}
