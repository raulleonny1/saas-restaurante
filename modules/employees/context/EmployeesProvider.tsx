"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import {
  archiveEmployee,
  importMembersAsEmployees,
  linkEmployeeUid,
  markEmployeeInviteSent,
  restoreEmployee,
  setEmployeeAssignedTables,
  setEmployeeStatus,
  subscribeEmployees,
  upsertEmployee,
  upsertEmployeeEmailIndex,
} from "@/modules/employees/services/employees.service";
import {
  deleteEmployeeRecord,
  subscribeEmployeeRecords,
  upsertEmployeeRecord,
} from "@/modules/employees/services/records.service";
import {
  deleteShift,
  subscribeShifts,
  upsertShift,
} from "@/modules/employees/services/shifts.service";
import {
  ensureStaffInvite,
  inviteMember,
  updateMember,
} from "@/modules/tenant/services/members.service";
import { resetPassword } from "@/services/auth.service";
import type {
  Employee,
  EmployeeIdDocumentType,
  EmployeeRecord,
  EmployeeRecordType,
  EmployeeShift,
  EmploymentType,
} from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type EmployeesListMode = "roster" | "history";

interface EmployeesContextValue {
  ready: boolean;
  error: string | null;
  /** Equipo visible en el panel (sin eliminados). */
  employees: Employee[];
  /** Soft-deleted: no salen en el roster, sí en historial. */
  archivedEmployees: Employee[];
  listMode: EmployeesListMode;
  setListMode: (mode: EmployeesListMode) => void;
  shifts: EmployeeShift[];
  selectedId: string | null;
  selected: Employee | null;
  selectEmployee: (id: string | null) => void;
  saveEmployee: (input: {
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
    sendInvite?: boolean;
  }) => Promise<Employee>;
  /** Send / resend Auth invite and mark inviteSentAt on the employee. */
  sendAccessInvite: (employeeId: string) => Promise<void>;
  /** Envía email de Firebase para que el empleado elija una nueva clave. */
  resetEmployeePassword: (employeeId: string) => Promise<void>;
  /** Eliminar → historial (soft-delete). */
  archive: (employeeId: string) => Promise<void>;
  /** Restaurar desde historial al listado activo. */
  restore: (employeeId: string) => Promise<void>;
  /** Mesas que atenderá este mesero. */
  assignTables: (employeeId: string, tableIds: string[]) => Promise<void>;
  setStatus: (
    employeeId: string,
    status: Employee["status"],
  ) => Promise<void>;
  importFromMembers: () => Promise<number>;
  saveShift: (input: {
    shift?: EmployeeShift | null;
    branchId: string;
    employeeId: string;
    startsAt: string;
    endsAt: string;
    roleId: RoleId;
    notes?: string;
  }) => Promise<EmployeeShift>;
  removeShift: (shiftId: string) => Promise<void>;
  shiftsForSelected: EmployeeShift[];
  records: EmployeeRecord[];
  recordsForSelected: EmployeeRecord[];
  saveRecord: (input: {
    record?: EmployeeRecord | null;
    employeeId: string;
    type: EmployeeRecordType;
    title: string;
    body: string;
  }) => Promise<EmployeeRecord>;
  removeRecord: (recordId: string) => Promise<void>;
}

const Ctx = createContext<EmployeesContextValue | null>(null);

export function useEmployees() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEmployees requires EmployeesProvider");
  return ctx;
}

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurantId, restaurant } = useRestaurant();
  const { members, branches } = useTenant();
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<EmployeesListMode>("roster");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employees = useMemo(
    () => allEmployees.filter((e) => !e.deletedAt),
    [allEmployees],
  );
  const archivedEmployees = useMemo(
    () =>
      allEmployees
        .filter((e) => Boolean(e.deletedAt))
        .sort((a, b) =>
          (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
        ),
    [allEmployees],
  );

  useEffect(() => {
    if (!restaurantId) {
      setAllEmployees([]);
      setShifts([]);
      setRecords([]);
      setReady(true);
      return;
    }
    setReady(false);
    const u1 = subscribeEmployees(
      restaurantId,
      (rows) => {
        setAllEmployees(rows);
        setReady(true);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setReady(true);
      },
    );
    const u2 = subscribeShifts(
      restaurantId,
      setShifts,
      (e) => setError(e.message),
    );
    const u3 = subscribeEmployeeRecords(
      restaurantId,
      setRecords,
      (e) => setError(e.message),
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [restaurantId]);

  /**
   * Backfill: índice + memberInvites. Sin invite el mesero entra como "cliente"
   * y el login lo manda al home.
   */
  const indexSyncRef = useRef(new Set<string>());
  useEffect(() => {
    if (!employees.length || !restaurantId || !restaurant || !user) return;
    for (const emp of employees) {
      if (emp.status !== "active" || emp.deletedAt || emp.uid) continue;
      const key = emp.email;
      if (indexSyncRef.current.has(key)) continue;
      indexSyncRef.current.add(key);
      void (async () => {
        try {
          await upsertEmployeeEmailIndex(emp);
          await ensureStaffInvite({
            restaurantId,
            restaurantName: restaurant.name,
            email: emp.email,
            roleId: emp.roleId,
            branchIds: emp.branchIds,
            invitedBy: user.uid,
          });
          if (!emp.inviteSentAt) {
            await markEmployeeInviteSent({
              restaurantId,
              employeeId: emp.id,
            });
          }
        } catch (e) {
          console.warn("[EmployeesProvider] backfill acceso:", e);
          indexSyncRef.current.delete(key);
        }
      })();
    }
  }, [employees, restaurantId, restaurant, user]);

  /** Link employee docs to Auth members when email matches. */
  const linkingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!restaurantId || !members.length || !employees.length) return;
    for (const emp of employees) {
      if (emp.uid || linkingRef.current.has(emp.id)) continue;
      const match = members.find(
        (m) => m.email.trim().toLowerCase() === emp.email.trim().toLowerCase(),
      );
      if (!match) continue;
      linkingRef.current.add(emp.id);
      void linkEmployeeUid({
        restaurantId,
        employeeId: emp.id,
        uid: match.uid,
      }).finally(() => {
        linkingRef.current.delete(emp.id);
      });
    }
  }, [restaurantId, employees, members]);

  const selected =
    allEmployees.find((e) => e.id === selectedId) ?? null;

  const shiftsForSelected = useMemo(() => {
    if (!selectedId) return [];
    return shifts.filter((s) => s.employeeId === selectedId);
  }, [shifts, selectedId]);

  const recordsForSelected = useMemo(() => {
    if (!selectedId) return [];
    return records.filter((r) => r.employeeId === selectedId);
  }, [records, selectedId]);

  const saveEmployee = useCallback(
    async (input: {
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
      sendInvite?: boolean;
    }) => {
      if (!restaurantId || !restaurant || !user) {
        throw new Error("Sesión incompleta");
      }
      const linked = members.find(
        (m) => m.email.trim().toLowerCase() === input.email.trim().toLowerCase(),
      );
      const row = await upsertEmployee({
        restaurantId,
        employee: input.employee,
        name: input.name,
        email: input.email,
        phone: input.phone,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        roleId: input.roleId,
        employmentType: input.employmentType,
        branchIds:
          input.branchIds.length > 0
            ? input.branchIds
            : branches[0]
              ? [branches[0].id]
              : [],
        hireDate: input.hireDate,
        notes: input.notes,
        status: input.status,
        uid: linked?.uid ?? input.employee?.uid,
      });

      if (input.sendInvite && !linked) {
        await inviteMember({
          restaurantId,
          restaurantName: restaurant.name,
          email: input.email,
          roleId: input.roleId,
          branchIds: row.branchIds,
          invitedBy: user.uid,
        });
        await markEmployeeInviteSent({
          restaurantId,
          employeeId: row.id,
        });
        row.inviteSentAt = new Date().toISOString();
      }

      // Empleado ya con cuenta: sincronizar rol/sucursales en membership
      // (varios cajeros/meseros del mismo local = cuentas Auth distintas)
      const memberUid = linked?.uid ?? row.uid;
      if (memberUid) {
        try {
          await updateMember({
            restaurantId,
            uid: memberUid,
            patch: {
              roleId: row.roleId,
              branchIds: row.branchIds,
              displayName: row.name,
            },
          });
        } catch (e) {
          // No tumbar el alta del empleado si falla el sync de member
          console.warn("[EmployeesProvider] sync member:", e);
        }
      }

      setSelectedId(row.id);
      return row;
    },
    [restaurantId, restaurant, user, members, branches],
  );

  const sendAccessInvite = useCallback(
    async (employeeId: string) => {
      if (!restaurantId || !restaurant || !user) {
        throw new Error("Sesión incompleta");
      }
      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) throw new Error("Empleado no encontrado");
      if (emp.deletedAt) throw new Error("Empleado en historial; restáuralo primero");
      if (emp.uid) throw new Error("Ya tiene cuenta vinculada");

      const linked = members.find(
        (m) => m.email.trim().toLowerCase() === emp.email.trim().toLowerCase(),
      );
      if (linked) {
        await linkEmployeeUid({
          restaurantId,
          employeeId: emp.id,
          uid: linked.uid,
        });
        return;
      }

      await inviteMember({
        restaurantId,
        restaurantName: restaurant.name,
        email: emp.email,
        roleId: emp.roleId,
        branchIds: emp.branchIds,
        invitedBy: user.uid,
      });
      await markEmployeeInviteSent({
        restaurantId,
        employeeId: emp.id,
      });
    },
    [restaurantId, restaurant, user, employees, members],
  );

  const resetEmployeePassword = useCallback(
    async (employeeId: string) => {
      const emp = allEmployees.find((e) => e.id === employeeId);
      if (!emp) throw new Error("Empleado no encontrado");
      if (emp.deletedAt) {
        throw new Error("Empleado en historial; restáuralo primero");
      }
      if (!emp.email?.trim()) {
        throw new Error("El empleado no tiene email");
      }
      await resetPassword({ email: emp.email });
    },
    [allEmployees],
  );

  const archive = useCallback(
    async (employeeId: string) => {
      if (!restaurantId) return;
      const emp = allEmployees.find((e) => e.id === employeeId);
      await archiveEmployee({
        restaurantId,
        employeeId,
        email: emp?.email,
      });
      setSelectedId(null);
      setListMode("roster");
    },
    [restaurantId, allEmployees],
  );

  const restore = useCallback(
    async (employeeId: string) => {
      if (!restaurantId) return;
      const emp = allEmployees.find((e) => e.id === employeeId);
      if (!emp) throw new Error("Empleado no encontrado");
      await restoreEmployee({ restaurantId, employee: emp });
      setListMode("roster");
      setSelectedId(employeeId);
    },
    [restaurantId, allEmployees],
  );

  const assignTables = useCallback(
    async (employeeId: string, tableIds: string[]) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      await setEmployeeAssignedTables({
        restaurantId,
        employeeId,
        tableIds,
      });
    },
    [restaurantId],
  );

  const value: EmployeesContextValue = {
    ready,
    error,
    employees,
    archivedEmployees,
    listMode,
    setListMode,
    shifts,
    selectedId,
    selected,
    selectEmployee: setSelectedId,
    saveEmployee,
    sendAccessInvite,
    resetEmployeePassword,
    archive,
    restore,
    assignTables,
    setStatus: async (employeeId, status) => {
      if (!restaurantId) return;
      await setEmployeeStatus({ restaurantId, employeeId, status });
    },
    importFromMembers: async () => {
      if (!restaurantId) return 0;
      return importMembersAsEmployees({
        restaurantId,
        members,
        existing: employees,
      });
    },
    saveShift: async (input) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      return upsertShift({ restaurantId, ...input });
    },
    removeShift: async (shiftId) => {
      if (!restaurantId) return;
      await deleteShift({ restaurantId, shiftId });
    },
    shiftsForSelected,
    records,
    recordsForSelected,
    saveRecord: async (input) => {
      if (!restaurantId || !user) throw new Error("Sin restaurante");
      return upsertEmployeeRecord({
        restaurantId,
        record: input.record,
        employeeId: input.employeeId,
        type: input.type,
        title: input.title,
        body: input.body,
        createdByUid: user.uid,
        createdByName: user.displayName || user.email,
      });
    },
    removeRecord: async (recordId) => {
      if (!restaurantId) return;
      await deleteEmployeeRecord({ restaurantId, recordId });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
