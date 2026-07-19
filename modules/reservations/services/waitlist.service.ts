"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/reservations/domain/ids";
import { createReservation } from "@/modules/reservations/services/reservations.service";
import type { Table } from "@/types/orders";
import type { Reservation, WaitlistEntry } from "@/types/reservations";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeWaitlist(
  restaurantId: string,
  branchId: string,
  onData: (rows: WaitlistEntry[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "waitlist"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as WaitlistEntry)
          .filter((w) => !w.deletedAt && w.status === "waiting")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function addWaitlistEntry(input: {
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  preferredStartsAt?: string;
  notes?: string;
  createdBy: string;
}): Promise<WaitlistEntry> {
  const stamp = nowIso();
  const id = newId("wtl");
  const row: WaitlistEntry = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    partySize: input.partySize,
    preferredStartsAt: input.preferredStartsAt,
    status: "waiting",
    notes: input.notes,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "waitlist", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function seatFromWaitlist(input: {
  restaurantId: string;
  branchId: string;
  entry: WaitlistEntry;
  startsAt: string;
  durationMinutes: number;
  tables: Table[];
  existing: Reservation[];
  createdBy: string;
  autoAssign: boolean;
}): Promise<Reservation> {
  const reservation = await createReservation({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerName: input.entry.customerName,
    customerPhone: input.entry.customerPhone,
    customerEmail: input.entry.customerEmail,
    partySize: input.entry.partySize,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    notes: input.entry.notes,
    source: "waitlist",
    autoAssign: input.autoAssign,
    tables: input.tables,
    existing: input.existing,
    createdBy: input.createdBy,
  });

  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "waitlist",
      input.entry.id,
    ),
    {
      status: "booked",
      offeredReservationId: reservation.id,
      offeredTableId: reservation.tableId ?? null,
      updatedAt: nowIso(),
    },
  );
  await batch.commit();
  return reservation;
}

export async function cancelWaitlistEntry(input: {
  restaurantId: string;
  entryId: string;
}): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", input.restaurantId, "waitlist", input.entryId),
    { status: "cancelled", updatedAt: nowIso() },
  );
  await batch.commit();
}
