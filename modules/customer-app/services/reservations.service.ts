"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/customer-app/domain/ids";
import type { Reservation } from "@/types/reservations";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
} from "firebase/firestore";

export function subscribeMyReservations(
  restaurantId: string,
  customerUid: string,
  onData: (rows: Reservation[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "reservations"),
    where("customerUid", "==", customerUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Reservation & {
            customerUid?: string;
          })
          .filter((r) => !r.deletedAt)
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function bookCustomerReservation(input: {
  restaurantId: string;
  branchId: string;
  customerId: string;
  customerUid: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  startsAt: string;
  notes?: string;
  tableId?: string | null;
  tableName?: string | null;
  durationMinutes?: number;
}): Promise<Reservation> {
  const stamp = nowIso();
  const id = newId("res");
  const startsAt = new Date(input.startsAt).toISOString();
  const ends = new Date(startsAt);
  ends.setMinutes(ends.getMinutes() + (input.durationMinutes ?? 90));
  const row: Reservation & { customerUid: string } = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerId: input.customerId,
    customerUid: input.customerUid,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    partySize: input.partySize,
    tableId: input.tableId ?? null,
    tableName: input.tableName ?? null,
    startsAt,
    endsAt: ends.toISOString(),
    status: "pending",
    source: "app",
    confirmationSent: false,
    reminderSent: false,
    notes: input.notes,
    createdBy: input.customerUid,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "reservations", id),
    stripUndefined({ ...row }),
  );
  await setDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "publicBookingSlots",
      id,
    ),
    {
      id: row.id,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      tableId: row.tableId ?? null,
      partySize: row.partySize,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      updatedAt: stamp,
    },
  );
  return row;
}
