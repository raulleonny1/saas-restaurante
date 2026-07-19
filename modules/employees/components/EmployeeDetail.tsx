"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import { ShiftFormModal } from "@/modules/employees/components/ShiftFormModal";
import type { EmployeeShift } from "@/types/employees";
import { Badge, Button, toast } from "@/ui";
import { CalendarPlus, Mail, Pencil, Trash2, UserX } from "lucide-react";
import { useState } from "react";

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Jornada completa",
  part_time: "Media jornada",
  contractor: "Autónomo",
  temp: "Temporal",
};

export function EmployeeDetail({
  onEdit,
  canManage,
}: {
  onEdit: () => void;
  canManage: boolean;
}) {
  const {
    selected,
    shiftsForSelected,
    archive,
    setStatus,
    removeShift,
    sendAccessInvite,
  } = useEmployees();
  const { branches } = useTenant();
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<EmployeeShift | null>(null);
  const [inviting, setInviting] = useState(false);

  if (!selected) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-muted/30 p-6 text-center text-sm text-fg-muted">
        Selecciona un empleado para ver ficha y turnos.
      </div>
    );
  }

  const branchNames = selected.branchIds
    .map((id) => branches.find((b) => b.id === id)?.name ?? id)
    .join(", ");

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title">{selected.name}</h2>
              <Badge tone={selected.status === "active" ? "success" : "neutral"}>
                {selected.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {ROLE_LABELS[selected.roleId] ?? selected.roleId} ·{" "}
              {EMPLOYMENT_LABEL[selected.employmentType] ??
                selected.employmentType}
            </p>
            <p className="text-caption">{selected.email}</p>
            {selected.phone ? (
              <p className="text-caption">{selected.phone}</p>
            ) : null}
            {branchNames ? (
              <p className="mt-1 text-caption">Sucursales: {branchNames}</p>
            ) : null}
            {selected.uid ? (
              <p className="mt-1 text-[11px] text-success">
                Cuenta vinculada · puede iniciar sesión
              </p>
            ) : selected.inviteSentAt ? (
              <p className="mt-1 text-[11px] text-fg-muted">
                Invitación pendiente — que se registre o inicie sesión con{" "}
                {selected.email} (enviada{" "}
                {new Date(selected.inviteSentAt).toLocaleDateString("es-ES")})
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-fg-muted">
                Ficha guardada. Aún sin acceso a la app — envía una invitación.
              </p>
            )}
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {!selected.uid ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={inviting}
                  onClick={() => {
                    setInviting(true);
                    void sendAccessInvite(selected.id)
                      .then(() =>
                        toast(
                          "Invitación enviada. Cuando inicie sesión con ese email, se vinculará la cuenta.",
                          "success",
                        ),
                      )
                      .catch((e) =>
                        toast(
                          e instanceof Error ? e.message : "No se pudo invitar",
                          "error",
                        ),
                      )
                      .finally(() => setInviting(false));
                  }}
                >
                  <Mail className="h-3.5 w-3.5" />{" "}
                  {selected.inviteSentAt
                    ? "Reenviar invitación"
                    : "Invitar acceso"}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              {selected.status === "active" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void setStatus(selected.id, "inactive").then(() =>
                      toast("Empleado desactivado", "success"),
                    )
                  }
                >
                  Desactivar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void setStatus(selected.id, "active").then(() =>
                      toast("Empleado reactivado", "success"),
                    )
                  }
                >
                  Reactivar
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void archive(selected.id)
                    .then(() => toast("Empleado archivado", "success"))
                    .catch((e) =>
                      toast(e instanceof Error ? e.message : "Error", "error"),
                    )
                }
              >
                <UserX className="h-3.5 w-3.5" /> Archivar
              </Button>
            </div>
          ) : null}
        </div>
        {selected.notes ? (
          <p className="mt-3 text-sm text-fg-muted">{selected.notes}</p>
        ) : null}
        {selected.hireDate ? (
          <p className="mt-2 text-caption">
            Alta: {new Date(selected.hireDate).toLocaleDateString("es-ES")}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h3 className="text-sm font-medium">Turnos</h3>
        {canManage ? (
          <Button
            size="sm"
            onClick={() => {
              setEditingShift(null);
              setShiftOpen(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Nuevo turno
          </Button>
        ) : null}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 sm:px-5">
        {shiftsForSelected.map((s) => (
          <li
            key={s.id}
            className="rounded-[var(--radius-md)] border border-border px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {new Date(s.startsAt).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  →{" "}
                  {new Date(s.endsAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-caption">
                  {ROLE_LABELS[s.roleId] ?? s.roleId} ·{" "}
                  {branches.find((b) => b.id === s.branchId)?.name ?? s.branchId}
                </p>
                {s.notes ? (
                  <p className="mt-1 text-xs text-fg-muted">{s.notes}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingShift(s);
                      setShiftOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void removeShift(s.id)
                        .then(() => toast("Turno eliminado", "success"))
                        .catch((e) =>
                          toast(
                            e instanceof Error ? e.message : "Error",
                            "error",
                          ),
                        )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {!shiftsForSelected.length ? (
          <li className="py-8 text-center text-sm text-fg-muted">
            Sin turnos programados.
          </li>
        ) : null}
      </ul>

      <ShiftFormModal
        open={shiftOpen}
        onClose={() => {
          setShiftOpen(false);
          setEditingShift(null);
        }}
        shift={editingShift}
        defaultEmployeeId={selected.id}
      />
    </div>
  );
}
