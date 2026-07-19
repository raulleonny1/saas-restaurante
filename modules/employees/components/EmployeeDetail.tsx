"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { RecordFormModal } from "@/modules/employees/components/RecordFormModal";
import { ShiftFormModal } from "@/modules/employees/components/ShiftFormModal";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { EmployeeRecord, EmployeeRecordType, EmployeeShift } from "@/types/employees";
import { Badge, Button, toast } from "@/ui";
import {
  AlertTriangle,
  CalendarPlus,
  FileWarning,
  KeyRound,
  Mail,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Jornada completa",
  part_time: "Media jornada",
  contractor: "Autónomo",
  temp: "Temporal",
};

const DOC_LABEL: Record<string, string> = {
  nif: "NIF",
  nie: "NIE",
  cedula: "Cédula",
  pasaporte: "Pasaporte",
};

const RECORD_LABEL: Record<EmployeeRecordType, string> = {
  warning: "Llamado de atención",
  incident: "Incidencia",
  note: "Nota",
  praise: "Reconocimiento",
};

function recordTone(
  type: EmployeeRecordType,
): "warning" | "danger" | "neutral" | "success" {
  if (type === "warning") return "warning";
  if (type === "incident") return "danger";
  if (type === "praise") return "success";
  return "neutral";
}

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
    recordsForSelected,
    archive,
    restore,
    setStatus,
    removeShift,
    removeRecord,
    sendAccessInvite,
    resetEmployeePassword,
    listMode,
  } = useEmployees();
  const { branches } = useTenant();
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<EmployeeShift | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EmployeeRecord | null>(
    null,
  );
  const [inviting, setInviting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!selected) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-bg-muted/30 p-6 text-center text-sm text-fg-muted">
        {listMode === "history"
          ? "Selecciona un empleado del historial para ver su ficha y turnos."
          : "Selecciona un empleado para ver ficha y turnos."}
      </div>
    );
  }

  const isArchived = Boolean(selected.deletedAt);
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
              <Badge
                tone={
                  isArchived
                    ? "neutral"
                    : selected.status === "active"
                      ? "success"
                      : "neutral"
                }
              >
                {isArchived ? "en historial" : selected.status}
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
            {selected.documentNumber ? (
              <p className="text-caption">
                {DOC_LABEL[selected.documentType ?? ""] ??
                  selected.documentType ??
                  "Documento"}
                : {selected.documentNumber}
              </p>
            ) : null}
            {branchNames ? (
              <p className="mt-1 text-caption">Sucursales: {branchNames}</p>
            ) : null}
            {isArchived ? (
              <p className="mt-1 text-[11px] text-fg-muted">
                Eliminado del equipo el{" "}
                {selected.deletedAt
                  ? new Date(selected.deletedAt).toLocaleString("es-ES")
                  : "—"}
                . No aparece en el listado activo.
              </p>
            ) : selected.uid ? (
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
                Ficha en el equipo, pero aún no puede entrar a la app. Pulsa{" "}
                <strong>Dar acceso a la app</strong> y que haga login con este
                email.
              </p>
            )}
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {isArchived ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void restore(selected.id)
                      .then(() =>
                        toast("Empleado restaurado al equipo", "success"),
                      )
                      .catch((e) =>
                        toast(
                          e instanceof Error ? e.message : "Error",
                          "error",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar al equipo
                </Button>
              ) : (
                <>
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
                              "Acceso listo. Que entre en /login con ese email y cree su clave (primera vez).",
                              "success",
                            ),
                          )
                          .catch((e) =>
                            toast(
                              e instanceof Error
                                ? e.message
                                : "No se pudo invitar",
                              "error",
                            ),
                          )
                          .finally(() => setInviting(false));
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />{" "}
                      {selected.inviteSentAt
                        ? "Reenviar acceso"
                        : "Dar acceso a la app"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={resetting}
                    title={`Enviar enlace de nueva clave a ${selected.email}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Enviar a ${selected.email} un enlace para crear una nueva contraseña?\n\nSi aún no tiene cuenta, primero debe entrar una vez en /login.`,
                        )
                      ) {
                        return;
                      }
                      setResetting(true);
                      void resetEmployeePassword(selected.id)
                        .then(() =>
                          toast(
                            `Email enviado a ${selected.email}. Que revise bandeja (y spam).`,
                            "success",
                          ),
                        )
                        .catch((e) =>
                          toast(
                            e instanceof Error ? e.message : "No se pudo enviar",
                            "error",
                          ),
                        )
                        .finally(() => setResetting(false));
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />{" "}
                    {resetting ? "Enviando…" : "Resetear clave"}
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
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Eliminar a ${selected.name} del equipo?\n\nNo se borra del todo: pasa al historial y puedes consultarlo o restaurarlo después.`,
                        )
                      ) {
                        return;
                      }
                      setBusy(true);
                      void archive(selected.id)
                        .then(() =>
                          toast(
                            "Empleado movido al historial",
                            "success",
                          ),
                        )
                        .catch((e) =>
                          toast(
                            e instanceof Error ? e.message : "Error",
                            "error",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </>
              )}
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

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
        {/* Jornada laboral */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Jornada laboral y turnos</h3>
            {canManage && !isArchived ? (
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
          <p className="mb-3 text-caption">
            Tipo de jornada:{" "}
            <strong>
              {EMPLOYMENT_LABEL[selected.employmentType] ??
                selected.employmentType}
            </strong>
            {selected.hireDate
              ? ` · Alta ${new Date(selected.hireDate).toLocaleDateString("es-ES")}`
              : null}
          </p>
          <ul className="space-y-2">
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
                      {branches.find((b) => b.id === s.branchId)?.name ??
                        s.branchId}
                    </p>
                    {s.notes ? (
                      <p className="mt-1 text-xs text-fg-muted">{s.notes}</p>
                    ) : null}
                  </div>
                  {canManage && !isArchived ? (
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
              <li className="rounded-[var(--radius-md)] border border-dashed border-border py-6 text-center text-sm text-fg-muted">
                Sin turnos programados.
              </li>
            ) : null}
          </ul>
        </section>

        {/* Expediente */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <FileWarning className="h-4 w-4" />
              Expediente
              {recordsForSelected.length ? (
                <Badge tone="warning">{recordsForSelected.length}</Badge>
              ) : null}
            </h3>
            {canManage && !isArchived ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingRecord(null);
                  setRecordOpen(true);
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Llamado / nota
              </Button>
            ) : null}
          </div>
          <p className="mb-3 text-caption">
            Llamados de atención, incidencias, notas y reconocimientos.
          </p>
          <ul className="space-y-2">
            {recordsForSelected.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-md)] border border-border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={recordTone(r.type)}>
                        {RECORD_LABEL[r.type]}
                      </Badge>
                      <span className="text-sm font-medium">{r.title}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-fg-muted">
                      {r.body}
                    </p>
                    <p className="mt-1 text-[11px] text-fg-muted">
                      {new Date(r.createdAt).toLocaleString("es-ES")} ·{" "}
                      {r.createdByName}
                    </p>
                  </div>
                  {canManage && !isArchived ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingRecord(r);
                          setRecordOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "¿Eliminar esta entrada del expediente?",
                            )
                          ) {
                            return;
                          }
                          void removeRecord(r.id)
                            .then(() => toast("Entrada eliminada", "success"))
                            .catch((e) =>
                              toast(
                                e instanceof Error ? e.message : "Error",
                                "error",
                              ),
                            );
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {!recordsForSelected.length ? (
              <li className="rounded-[var(--radius-md)] border border-dashed border-border py-6 text-center text-sm text-fg-muted">
                Sin llamados de atención ni notas en el expediente.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <ShiftFormModal
        open={shiftOpen}
        onClose={() => {
          setShiftOpen(false);
          setEditingShift(null);
        }}
        shift={editingShift}
        defaultEmployeeId={selected.id}
      />
      <RecordFormModal
        open={recordOpen}
        onClose={() => {
          setRecordOpen(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        defaultEmployeeId={selected.id}
      />
    </div>
  );
}
