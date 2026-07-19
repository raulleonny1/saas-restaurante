"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/employees/domain/ids";
import type {
  Employee,
  EmploymentType,
} from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import type { Member } from "@/types/restaurant";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

export function subscribeEmployees(
  restaurantId: string,
  onData: (rows: Employee[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employees"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Employee)
          .filter((e) => !e.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertEmployee(input: {
  restaurantId: string;
  employee?: Employee | null;
  name: string;
  email: string;
  phone?: string;
  roleId: RoleId;
  employmentType: EmploymentType;
  branchIds: string[];
  hireDate?: string;
  notes?: string;
  status?: Employee["status"];
  uid?: string;
  inviteSentAt?: string | null;
}): Promise<Employee> {
  const stamp = nowIso();
  const id = input.employee?.id ?? newId("emp");
  const inviteSentAt =
    input.inviteSentAt === null
      ? undefined
      : (input.inviteSentAt ?? input.employee?.inviteSentAt);
  const row: Employee = {
    id,
    restaurantId: input.restaurantId,
    uid: input.uid ?? input.employee?.uid,
    inviteSentAt,
    branchIds: input.branchIds,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
    roleId: input.roleId,
    employmentType: input.employmentType,
    status: input.status ?? input.employee?.status ?? "active",
    hireDate: input.hireDate || input.employee?.hireDate,
    salesTotal: input.employee?.salesTotal ?? 0,
    notes: input.notes?.trim() || undefined,
    pinCodeHash: input.employee?.pinCodeHash,
    createdAt: input.employee?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "employees", id),
    stripUndefined({ ...row }),
  );
  return row;
}

export async function archiveEmployee(input: {
  restaurantId: string;
  employeeId: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employeeId,
    ),
    {
      status: "inactive",
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    },
  );
}

export async function linkEmployeeUid(input: {
  restaurantId: string;
  employeeId: string;
  uid: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employeeId,
    ),
    {
      uid: input.uid,
      updatedAt: nowIso(),
    },
  );
}

export async function markEmployeeInviteSent(input: {
  restaurantId: string;
  employeeId: string;
}): Promise<void> {
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employeeId,
    ),
    {
      inviteSentAt: nowIso(),
      updatedAt: nowIso(),
    },
  );
}

export async function setEmployeeStatus(input: {
  restaurantId: string;
  employeeId: string;
  status: Employee["status"];
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: nowIso(),
  };
  if (input.status === "active") {
    patch.deletedAt = null;
  }
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employeeId,
    ),
    patch,
  );
}

/** Import active Auth members that are not yet in the employees collection. */
export async function importMembersAsEmployees(input: {
  restaurantId: string;
  members: Member[];
  existing: Employee[];
}): Promise<number> {
  const byEmail = new Set(
    input.existing.map((e) => e.email.trim().toLowerCase()),
  );
  const byUid = new Set(
    input.existing.map((e) => e.uid).filter(Boolean) as string[],
  );

  let created = 0;
  for (const m of input.members) {
    if (!m.active) continue;
    if (m.roleId === "cliente" || m.role === "cliente") continue;
    const email = m.email.trim().toLowerCase();
    if (byEmail.has(email) || byUid.has(m.uid)) continue;

    await upsertEmployee({
      restaurantId: input.restaurantId,
      name: m.displayName || email.split("@")[0] || "Empleado",
      email,
      roleId: m.roleId ?? m.role,
      employmentType: "full_time",
      branchIds: m.branchIds ?? [],
      uid: m.uid,
      status: "active",
      hireDate: m.joinedAt?.slice(0, 10),
      notes: "Importado desde membresía",
    });
    byEmail.add(email);
    byUid.add(m.uid);
    created += 1;
  }
  return created;
}
