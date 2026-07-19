"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type {
  Employee,
  EmployeeIdDocumentType,
  EmploymentType,
} from "@/types/employees";
import type { RoleId } from "@/types/rbac";
import { Button, Input, Modal, Select, toast } from "@/ui";
import { useEffect, useState } from "react";

const EMPLOYMENT: { id: EmploymentType; label: string }[] = [
  { id: "full_time", label: "Jornada completa" },
  { id: "part_time", label: "Media jornada" },
  { id: "contractor", label: "Autónomo / contrato" },
  { id: "temp", label: "Temporal" },
];

const DOC_TYPES: { id: EmployeeIdDocumentType; label: string }[] = [
  { id: "nif", label: "NIF" },
  { id: "nie", label: "NIE" },
  { id: "cedula", label: "Cédula" },
  { id: "pasaporte", label: "Pasaporte" },
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
  const [documentType, setDocumentType] =
    useState<EmployeeIdDocumentType | "">("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [roleId, setRoleId] = useState<RoleId>("mesero");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("full_time");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [hireDate, setHireDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(employee?.name ?? "");
    setEmail(employee?.email ?? "");
    setPhone(employee?.phone ?? "");
    setDocumentType(employee?.documentType ?? "");
    setDocumentNumber(employee?.documentNumber ?? "");
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
                    documentType: documentType || null,
                    documentNumber: documentNumber.trim()
                      ? documentNumber
                      : null,
                    roleId,
                    employmentType,
                    branchIds,
                    hireDate: hireDate || undefined,
                    notes,
                    // Alta nueva: siempre deja invitación para que active clave en /login
                    sendInvite: !employee,
                  });
                  toast(
                    employee
                      ? "Empleado actualizado"
                      : "Empleado listo. Que entre en /login con su email y cree su clave.",
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
        <Select
          label="Documento de identidad"
          value={documentType}
          onChange={(e) =>
            setDocumentType(e.target.value as EmployeeIdDocumentType | "")
          }
        >
          <option value="">Sin documento</option>
          {DOC_TYPES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Select>
        <Input
          label="Número (NIF / NIE / cédula / pasaporte)"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          placeholder="Ej. 12345678Z"
          autoComplete="off"
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
        <p className="mt-4 text-xs text-fg-muted">
          El mesero no se registra aparte: entra en <strong>/login</strong> con
          este email y elige su contraseña la primera vez.
        </p>
      ) : null}
    </Modal>
  );
}
