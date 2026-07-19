"use client";

import { getDb } from "@/lib/firebase";
import {
  isBlockingReservationStatus,
  reservationToPublicSlot,
  type PublicBookingSlot,
} from "@/modules/reservations/domain/publicSlot";
import { overlaps } from "@/modules/reservations/domain/time";
import type { Table } from "@/types/orders";
import type { Reservation } from "@/types/reservations";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";

export async function upsertPublicBookingSlot(
  reservation: Reservation,
): Promise<void> {
  const ref = doc(
    getDb(),
    "restaurants",
    reservation.restaurantId,
    "publicBookingSlots",
    reservation.id,
  );
  if (!isBlockingReservationStatus(reservation.status) || reservation.deletedAt) {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  const slot = reservationToPublicSlot(
    reservation,
    reservation.updatedAt || new Date().toISOString(),
  );
  await setDoc(ref, slot, { merge: true });
}

export async function loadPublicTables(
  restaurantId: string,
): Promise<Table[]> {
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "tables"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Table)
    .filter((t) => !t.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function subscribePublicBookingSlots(
  restaurantId: string,
  onData: (slots: PublicBookingSlot[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "publicBookingSlots"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PublicBookingSlot)
          .filter((s) => isBlockingReservationStatus(s.status)),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribePublicTables(
  restaurantId: string,
  onData: (tables: Table[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "tables"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Table)
          .filter((t) => !t.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

/** Mesas libres para un horario y número de comensales. */
export function availableTablesForSlot(input: {
  tables: Table[];
  slots: PublicBookingSlot[];
  branchId: string;
  partySize: number;
  startsAt: string;
  endsAt: string;
  ignoreSlotId?: string;
}): Table[] {
  const { tables, slots, branchId, partySize, startsAt, endsAt, ignoreSlotId } =
    input;
  return tables.filter((t) => {
    if (t.branchId !== branchId) return false;
    if (t.seats < partySize) return false;
    const busy = slots.some(
      (s) =>
        s.id !== ignoreSlotId &&
        s.branchId === branchId &&
        s.tableId === t.id &&
        isBlockingReservationStatus(s.status) &&
        overlaps(s.startsAt, s.endsAt, startsAt, endsAt),
    );
    return !busy;
  });
}
