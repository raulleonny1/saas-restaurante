"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import {
  archiveEmployee,
  importMembersAsEmployees,
  linkEmployeeUid,
  markEmployeeInviteSent,
  setEmployeeStatus,
  subscribeEmployees,
  upsertEmployee,
} from "@/modules/employees/services/employees.service";
import {
  deleteShift,
  subscribeShifts,
  upsertShift,
} from "@/modules/employees/services/shifts.service";
import { inviteMember } from "@/modules/tenant/services/members.service";
import type { Employee, EmployeeShift, EmploymentType } from "@/types/employees";
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

interface EmployeesContextValue {
  ready: boolean;
  error: string | null;
  employees: Employee[];
  shifts: EmployeeShift[];
  selectedId: string | null;
  selected: Employee | null;
  selectEmployee: (id: string | null) => void;
  saveEmployee: (input: {
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
    sendInvite?: boolean;
  }) => Promise<Employee>;
  /** Send / resend Auth invite and mark inviteSentAt on the employee. */
  sendAccessInvite: (employeeId: string) => Promise<void>;
  archive: (employeeId: string) => Promise<void>;
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setEmployees([]);
      setShifts([]);
      setReady(true);
      return;
    }
    setReady(false);
    const u1 = subscribeEmployees(
      restaurantId,
      (rows) => {
        setEmployees(rows);
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
    return () => {
      u1();
      u2();
    };
  }, [restaurantId]);

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
    employees.find((e) => e.id === selectedId) ?? null;

  const shiftsForSelected = useMemo(() => {
    if (!selectedId) return [];
    return shifts.filter((s) => s.employeeId === selectedId);
  }, [shifts, selectedId]);

  const saveEmployee = useCallback(
    async (input: {
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

  const value: EmployeesContextValue = {
    ready,
    error,
    employees,
    shifts,
    selectedId,
    selected,
    selectEmployee: setSelectedId,
    saveEmployee,
    sendAccessInvite,
    archive: async (employeeId) => {
      if (!restaurantId) return;
      await archiveEmployee({ restaurantId, employeeId });
      if (selectedId === employeeId) setSelectedId(null);
    },
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
