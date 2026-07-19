"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { Employee, EmploymentType } from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import { Button, Checkbox, Input, Modal, Select, toast } from "@/ui";
import { useEffect, useState } from "react";

const EMPLOYMENT: { id: EmploymentType; label: string }[] = [
  { id: "full_time", label: "Jornada completa" },
  { id: "part_time", label: "Media jornada" },
  { id: "contractor", label: "Autónomo / contrato" },
  { id: "temp", label: "Temporal" },
];

export function EmployeeFormModal({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}) {
  const { branches } = useTenant();
  const { saveEmployee } = useEmployees();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState<RoleId>("mesero");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("full_time");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [hireDate, setHireDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(employee?.name ?? "");
    setEmail(employee?.email ?? "");
    setPhone(employee?.phone ?? "");
    setRoleId(employee?.roleId ?? "mesero");
    setEmploymentType(employee?.employmentType ?? "full_time");
    setBranchIds(
      employee?.branchIds?.length
        ? employee.branchIds
        : branches[0]
          ? [branches[0].id]
          : [],
    );
    setHireDate(employee?.hireDate?.slice(0, 10) ?? "");
    setNotes(employee?.notes ?? "");
    setSendInvite(!employee);
  }, [open, employee, branches]);

  function toggleBranch(id: string) {
    setBranchIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee ? "Editar empleado" : "Nuevo empleado"}
      description="Ficha laboral en Firestore (restaurants/{id}/employees)."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !name.trim() || !email.trim()}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await saveEmployee({
                    employee,
                    name,
                    email,
                    phone,
                    roleId,
                    employmentType,
                    branchIds,
                    hireDate: hireDate || undefined,
                    notes,
                    sendInvite: !employee && sendInvite,
                  });
                  toast(
                    employee
                      ? "Empleado actualizado"
                      : sendInvite
                        ? "Empleado creado e invitación enviada"
                        : "Empleado creado",
                    "success",
                  );
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Fecha de alta"
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
        />
        <Select
          label="Rol"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value as RoleId)}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          label="Tipo de contrato"
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
        >
          {EMPLOYMENT.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm text-fg-muted">Sucursales</p>
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <label
              key={b.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                branchIds.includes(b.id)
                  ? "border-accent bg-accent-soft/40"
                  : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={branchIds.includes(b.id)}
                onChange={() => toggleBranch(b.id)}
              />
              {b.name}
            </label>
          ))}
          {!branches.length ? (
            <p className="text-xs text-fg-muted">
              No hay sucursales. Créalas en Ajustes.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <Input
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!employee ? (
        <div className="mt-4">
          <Checkbox
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
            label="Enviar invitación para que pueda iniciar sesión"
          />
        </div>
      ) : null}
    </Modal>
  );
}
