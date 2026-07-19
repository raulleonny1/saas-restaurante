"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { EmployeeShift } from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import { Button, Input, Modal, Select, toast } from "@/ui";
import { useEffect, useState } from "react";

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShiftFormModal({
  open,
  onClose,
  shift,
  defaultEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  shift?: EmployeeShift | null;
  defaultEmployeeId?: string;
}) {
  const { branches } = useTenant();
  const { employees, saveShift } = useEmployees();
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [roleId, setRoleId] = useState<RoleId>("mesero");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const emp =
      employees.find((e) => e.id === (shift?.employeeId ?? defaultEmployeeId)) ??
      employees[0];
    setEmployeeId(shift?.employeeId ?? emp?.id ?? "");
    setBranchId(
      shift?.branchId ??
        emp?.branchIds[0] ??
        branches.find((b) => b.isDefault)?.id ??
        branches[0]?.id ??
        "",
    );
    setStartsAt(toLocalInput(shift?.startsAt));
    setEndsAt(toLocalInput(shift?.endsAt));
    setRoleId(shift?.roleId ?? emp?.roleId ?? "mesero");
    setNotes(shift?.notes ?? "");
  }, [open, shift, defaultEmployeeId, employees, branches]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shift ? "Editar turno" : "Nuevo turno"}
      description="Se guarda en employeeShifts (Firestore)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !employeeId || !branchId || !startsAt || !endsAt}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await saveShift({
                    shift,
                    employeeId,
                    branchId,
                    startsAt,
                    endsAt,
                    roleId,
                    notes,
                  });
                  toast("Turno guardado", "success");
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Select
          label="Empleado"
          value={employeeId}
          onChange={(e) => {
            setEmployeeId(e.target.value);
            const emp = employees.find((x) => x.id === e.target.value);
            if (emp) setRoleId(emp.roleId);
          }}
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Select
          label="Sucursal"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select
          label="Rol en el turno"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value as RoleId)}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Input
          label="Inicio"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <Input
          label="Fin"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <Input
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
