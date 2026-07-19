"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { EmployeeShift } from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import { Button, Input, Modal, Select, toast } from "@/ui";
import { useEffect, useState } from "react";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitLocal(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function joinLocal(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
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
    const start = splitLocal(shift?.startsAt);
    const end = splitLocal(shift?.endsAt);
    const day = todayDate();
    setStartDate(start.date || day);
    setStartTime(start.time || "09:00");
    setEndDate(end.date || start.date || day);
    setEndTime(end.time || "17:00");
    setRoleId(shift?.roleId ?? emp?.roleId ?? "mesero");
    setNotes(shift?.notes ?? "");
  }, [open, shift, defaultEmployeeId, employees, branches]);

  const startsAt = joinLocal(startDate, startTime);
  const endsAt = joinLocal(endDate, endTime);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shift ? "Editar turno" : "Nuevo turno"}
      description="Fecha y hora del turno (jornada laboral)."
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha inicio"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) {
                setEndDate(e.target.value);
              }
            }}
          />
          <Input
            label="Hora inicio"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Input
            label="Hora fin"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <Input
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
