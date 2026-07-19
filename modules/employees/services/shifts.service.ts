"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/employees/domain/ids";
import type { EmployeeShift } from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

export function subscribeShifts(
  restaurantId: string,
  onData: (rows: EmployeeShift[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employeeShifts"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as EmployeeShift)
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertShift(input: {
  restaurantId: string;
  shift?: EmployeeShift | null;
  branchId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  roleId: RoleId;
  notes?: string;
}): Promise<EmployeeShift> {
  const stamp = nowIso();
  const id = input.shift?.id ?? newId("shift");
  const starts = new Date(input.startsAt).toISOString();
  const ends = new Date(input.endsAt).toISOString();
  if (ends <= starts) {
    throw new Error("La hora de fin debe ser posterior al inicio");
  }

  const row: EmployeeShift = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    employeeId: input.employeeId,
    startsAt: starts,
    endsAt: ends,
    roleId: input.roleId,
    notes: input.notes?.trim() || undefined,
    createdAt: input.shift?.createdAt ?? stamp,
    updatedAt: stamp,
  };

  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "employeeShifts", id),
    stripUndefined({ ...row }),
  );
  return row;
}

export async function deleteShift(input: {
  restaurantId: string;
  shiftId: string;
}): Promise<void> {
  await deleteDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employeeShifts",
      input.shiftId,
    ),
  );
}
