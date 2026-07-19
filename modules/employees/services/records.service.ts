import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/employees/domain/ids";
import type { EmployeeRecord, EmployeeRecordType } from "@/types/employees";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

export function subscribeEmployeeRecords(
  restaurantId: string,
  onData: (rows: EmployeeRecord[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employeeRecords"),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as EmployeeRecord)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      ),
    (err) => onError?.(err),
  );
}

export async function upsertEmployeeRecord(input: {
  restaurantId: string;
  record?: EmployeeRecord | null;
  employeeId: string;
  type: EmployeeRecordType;
  title: string;
  body: string;
  createdByUid: string;
  createdByName: string;
}): Promise<EmployeeRecord> {
  const stamp = nowIso();
  const id = input.record?.id ?? newId("erec");
  const row: EmployeeRecord = {
    id,
    restaurantId: input.restaurantId,
    employeeId: input.employeeId,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    createdByUid: input.record?.createdByUid ?? input.createdByUid,
    createdByName: input.record?.createdByName ?? input.createdByName,
    createdAt: input.record?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "employeeRecords", id),
    stripUndefined({ ...row }),
  );
  return row;
}

export async function deleteEmployeeRecord(input: {
  restaurantId: string;
  recordId: string;
}): Promise<void> {
  await deleteDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employeeRecords",
      input.recordId,
    ),
  );
}
