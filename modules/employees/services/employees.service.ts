"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/employees/domain/ids";
import type {
  Employee,
  EmployeeIdDocumentType,
  EmploymentType,
} from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import type { Member } from "@/types/restaurant";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

/** All employees including soft-deleted (historial). */
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
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

/** Asignación de mesas del empleado vinculado al Auth actual (app mesero). */
export function subscribeMyEmployeeAssignment(
  restaurantId: string,
  uid: string,
  email: string,
  onData: (assignedTableIds: string[] | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const emailNorm = email.trim().toLowerCase();
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employees"),
    (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Employee,
      );
      const me =
        rows.find((e) => !e.deletedAt && e.uid === uid) ??
        rows.find(
          (e) => !e.deletedAt && e.email.trim().toLowerCase() === emailNorm,
        );
      if (!me) {
        onData(null);
        return;
      }
      onData(me.assignedTableIds ?? []);
    },
    (err) => onError?.(err),
  );
}

export async function clearEmployeeEmailIndex(email: string): Promise<void> {
  const key = email.trim().toLowerCase();
  if (!key) return;
  try {
    await deleteDoc(doc(getDb(), "employeeEmailIndex", key));
  } catch {
    /* ignore missing */
  }
}

export async function upsertEmployee(input: {
  restaurantId: string;
  employee?: Employee | null;
  name: string;
  email: string;
  phone?: string;
  documentType?: EmployeeIdDocumentType | null;
  documentNumber?: string | null;
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
  const documentType =
    input.documentType === null
      ? undefined
      : (input.documentType ?? input.employee?.documentType);
  const rawNumber =
    input.documentNumber === null
      ? undefined
      : (input.documentNumber ?? input.employee?.documentNumber);
  const documentNumber = rawNumber?.trim().toUpperCase() || undefined;
  const row: Employee = {
    id,
    restaurantId: input.restaurantId,
    uid: input.uid ?? input.employee?.uid,
    inviteSentAt,
    branchIds: input.branchIds,
    assignedTableIds: input.employee?.assignedTableIds ?? [],
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
    documentType: documentNumber ? documentType : undefined,
    documentNumber,
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
  try {
    await upsertEmployeeEmailIndex(row);
  } catch (e) {
    console.warn("[upsertEmployee] employeeEmailIndex:", e);
  }
  return row;
}

/** Lookup doc so staff can activate on /login without a separate memberInvites row. */
export async function upsertEmployeeEmailIndex(
  employee: Employee,
): Promise<void> {
  const email = employee.email.trim().toLowerCase();
  if (!email || employee.deletedAt || employee.status === "inactive") {
    return;
  }
  await setDoc(
    doc(getDb(), "employeeEmailIndex", email),
    stripUndefined({
      email,
      restaurantId: employee.restaurantId,
      employeeId: employee.id,
      roleId: employee.roleId,
      branchIds: employee.branchIds ?? [],
      name: employee.name,
      status: employee.uid ? "linked" : "pending",
      updatedAt: nowIso(),
    }),
  );
}

/** Soft-delete: sale del listado activo y queda en historial. */
export async function archiveEmployee(input: {
  restaurantId: string;
  employeeId: string;
  email?: string;
}): Promise<void> {
  const stamp = nowIso();
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employeeId,
    ),
    {
      status: "archived",
      deletedAt: stamp,
      updatedAt: stamp,
    },
  );
  if (input.email) {
    await clearEmployeeEmailIndex(input.email);
  }
}

/** Vuelve al listado activo desde el historial. */
export async function restoreEmployee(input: {
  restaurantId: string;
  employee: Employee;
}): Promise<void> {
  const stamp = nowIso();
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "employees",
      input.employee.id,
    ),
    {
      status: "active",
      deletedAt: null,
      updatedAt: stamp,
    },
  );
  await upsertEmployeeEmailIndex({
    ...input.employee,
    status: "active",
    deletedAt: null,
    updatedAt: stamp,
  });
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

/** Asigna mesas que el mesero debe atender (panel administrador). */
export async function setEmployeeAssignedTables(input: {
  restaurantId: string;
  employeeId: string;
  tableIds: string[];
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
      assignedTableIds: input.tableIds,
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
