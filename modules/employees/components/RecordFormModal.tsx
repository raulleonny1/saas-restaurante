"use client";

import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { EmployeeRecord, EmployeeRecordType } from "@/types/employees";
import { Button, Input, Modal, Select, Textarea, toast } from "@/ui";
import { useEffect, useState } from "react";

const TYPES: { id: EmployeeRecordType; label: string }[] = [
  { id: "warning", label: "Llamado de atención" },
  { id: "incident", label: "Incidencia" },
  { id: "note", label: "Nota de expediente" },
  { id: "praise", label: "Reconocimiento" },
];

export function RecordFormModal({
  open,
  onClose,
  record,
  defaultEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  record?: EmployeeRecord | null;
  defaultEmployeeId?: string;
}) {
  const { employees, saveRecord } = useEmployees();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<EmployeeRecordType>("warning");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(
      record?.employeeId ??
        defaultEmployeeId ??
        employees[0]?.id ??
        "",
    );
    setType(record?.type ?? "warning");
    setTitle(record?.title ?? "");
    setBody(record?.body ?? "");
  }, [open, record, defaultEmployeeId, employees]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? "Editar entrada" : "Añadir al expediente"}
      description="Llamados de atención, incidencias y notas quedan en la ficha del empleado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !employeeId || !title.trim() || !body.trim()}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await saveRecord({
                    record,
                    employeeId,
                    type,
                    title,
                    body,
                  });
                  toast("Expediente actualizado", "success");
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
          onChange={(e) => setEmployeeId(e.target.value)}
          disabled={Boolean(defaultEmployeeId || record)}
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => setType(e.target.value as EmployeeRecordType)}
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Retraso reiterado"
          required
        />
        <Textarea
          label="Detalle"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Qué ocurrió, fecha, medidas tomadas…"
          rows={4}
          required
        />
      </div>
    </Modal>
  );
}
