"use client";

import { getDb } from "@/lib/firebase";
import {
  findBestTable,
  tableBusyInSlot,
} from "@/modules/reservations/domain/assignment";
import { newId, nowIso } from "@/modules/reservations/domain/ids";
import { isBlockingReservationStatus } from "@/modules/reservations/domain/publicSlot";
import { addMinutes } from "@/modules/reservations/domain/time";
import type { Table } from "@/types/orders";
import type {
  Reservation,
  ReservationSource,
  ReservationStatus,
} from "@/types/reservations";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeReservations(
  restaurantId: string,
  branchId: string,
  onData: (rows: Reservation[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "reservations"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Reservation)
          .filter((r) => !r.deletedAt)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export interface CreateReservationInput {
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string | null;
  partySize: number;
  startsAt: string;
  durationMinutes: number;
  tableId?: string | null;
  notes?: string;
  source?: ReservationSource;
  autoAssign: boolean;
  tables: Table[];
  existing: Reservation[];
  createdBy: string;
  reminderMinutesBefore?: number;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<Reservation> {
  const stamp = nowIso();
  const endsAt = addMinutes(input.startsAt, input.durationMinutes);
  let tableId = input.tableId ?? null;
  let tableName: string | null = null;
  let assignedAutomatically = false;

  if (input.autoAssign) {
    const best = findBestTable({
      tables: input.tables,
      reservations: input.existing,
      partySize: input.partySize,
      startsAt: input.startsAt,
      endsAt,
    });
    if (!best) {
      throw new Error(
        "No hay mesa disponible para ese horario y comensales. Añade a lista de espera.",
      );
    }
    tableId = best.id;
    tableName = best.name;
    assignedAutomatically = true;
  } else if (tableId) {
    tableName = input.tables.find((t) => t.id === tableId)?.name ?? null;
    const busy = tableBusyInSlot(
      tableId,
      input.existing,
      input.startsAt,
      endsAt,
    );
    if (busy) {
      throw new Error("La mesa seleccionada ya está reservada en ese horario");
    }
  }

  const id = newId("rsv");
  const row: Reservation = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    customerId: input.customerId ?? null,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    partySize: input.partySize,
    tableId,
    tableName,
    startsAt: input.startsAt,
    endsAt,
    status: "pending",
    notes: input.notes,
    source: input.source ?? "phone",
    reminderSent: false,
    reminderMinutesBefore: input.reminderMinutesBefore ?? 120,
    confirmationSent: false,
    assignedAutomatically,
    googleEventId: null,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "reservations", id),
    row,
  );
  if (isBlockingReservationStatus(row.status)) {
    batch.set(
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
  }
  await batch.commit();
  return row;
}

export async function updateReservationStatus(input: {
  restaurantId: string;
  reservation: Reservation;
  status: ReservationStatus;
}): Promise<void> {
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "reservations",
      input.reservation.id,
    ),
    { status: input.status, updatedAt: stamp },
  );
  const slotRef = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "publicBookingSlots",
    input.reservation.id,
  );
  if (isBlockingReservationStatus(input.status)) {
    batch.set(
      slotRef,
      {
        id: input.reservation.id,
        restaurantId: input.restaurantId,
        branchId: input.reservation.branchId,
        tableId: input.reservation.tableId ?? null,
        partySize: input.reservation.partySize,
        startsAt: input.reservation.startsAt,
        endsAt: input.reservation.endsAt,
        status: input.status,
        updatedAt: stamp,
      },
      { merge: true },
    );
  } else {
    batch.delete(slotRef);
  }
  await batch.commit();
}

export async function assignTable(input: {
  restaurantId: string;
  reservation: Reservation;
  tableId: string;
  tableName: string;
  automatic?: boolean;
}): Promise<void> {
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "reservations",
      input.reservation.id,
    ),
    {
      tableId: input.tableId,
      tableName: input.tableName,
      assignedAutomatically: Boolean(input.automatic),
      updatedAt: stamp,
    },
  );
  if (isBlockingReservationStatus(input.reservation.status)) {
    batch.set(
      doc(
        getDb(),
        "restaurants",
        input.restaurantId,
        "publicBookingSlots",
        input.reservation.id,
      ),
      {
        id: input.reservation.id,
        restaurantId: input.restaurantId,
        branchId: input.reservation.branchId,
        tableId: input.tableId,
        partySize: input.reservation.partySize,
        startsAt: input.reservation.startsAt,
        endsAt: input.reservation.endsAt,
        status: input.reservation.status,
        updatedAt: stamp,
      },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function autoAssignReservation(input: {
  restaurantId: string;
  reservation: Reservation;
  tables: Table[];
  existing: Reservation[];
}): Promise<Table> {
  const table = findBestTable({
    tables: input.tables,
    reservations: input.existing,
    partySize: input.reservation.partySize,
    startsAt: input.reservation.startsAt,
    endsAt: input.reservation.endsAt,
    ignoreReservationId: input.reservation.id,
  });
  if (!table) throw new Error("Sin mesa libre para autoasignar");
  await assignTable({
    restaurantId: input.restaurantId,
    reservation: input.reservation,
    tableId: table.id,
    tableName: table.name,
    automatic: true,
  });
  return table;
}

export async function markConfirmationSent(input: {
  restaurantId: string;
  reservation: Reservation;
}): Promise<void> {
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "reservations",
      input.reservation.id,
    ),
    {
      status:
        input.reservation.status === "pending"
          ? "confirmed"
          : input.reservation.status,
      confirmationSent: true,
      confirmationSentAt: stamp,
      updatedAt: stamp,
    },
  );

  // In-app notification
  const nId = newId("ntf");
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "notifications", nId), {
    id: nId,
    restaurantId: input.restaurantId,
    branchId: input.reservation.branchId,
    type: "reservation",
    title: "Reserva confirmada",
    body: `${input.reservation.customerName} · ${input.reservation.partySize} pax · ${input.reservation.tableName ?? "sin mesa"}`,
    href: "/reservations",
    read: false,
    createdAt: stamp,
    updatedAt: stamp,
  });

  await batch.commit();
}

export async function markReminderSent(input: {
  restaurantId: string;
  reservation: Reservation;
}): Promise<void> {
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "reservations",
      input.reservation.id,
    ),
    {
      reminderSent: true,
      reminderSentAt: stamp,
      updatedAt: stamp,
    },
  );
  const nId = newId("ntf");
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "notifications", nId), {
    id: nId,
    restaurantId: input.restaurantId,
    branchId: input.reservation.branchId,
    type: "reservation",
    title: "Recordatorio de reserva",
    body: `Recordatorio enviado a ${input.reservation.customerName} (${input.reservation.customerPhone || input.reservation.customerEmail || "sin contacto"})`,
    href: "/reservations",
    read: false,
    createdAt: stamp,
    updatedAt: stamp,
  });
  await batch.commit();
}

export function reservationsDueForReminder(
  reservations: Reservation[],
  now = Date.now(),
): Reservation[] {
  return reservations.filter((r) => {
    if (r.reminderSent) return false;
    if (!["pending", "confirmed"].includes(r.status)) return false;
    const mins = r.reminderMinutesBefore ?? 120;
    const start = new Date(r.startsAt).getTime();
    const dueAt = start - mins * 60_000;
    return now >= dueAt && now < start;
  });
}
