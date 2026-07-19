"use client";

import { useAuth } from "@/context/AuthProvider";
import { EmployeeDetail } from "@/modules/employees/components/EmployeeDetail";
import { EmployeeFormModal } from "@/modules/employees/components/EmployeeFormModal";
import { EmployeeList } from "@/modules/employees/components/EmployeeList";
import { ShiftFormModal } from "@/modules/employees/components/ShiftFormModal";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import { Button, Modal } from "@/ui";
import { CalendarPlus, History, Plus } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Ficha completa del personal: datos, jornada/turnos y expediente
 * (llamados de atención, incidencias, notas).
 */
export function EmployeeFichasModal({
  open,
  onClose,
  initialEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  /** Si viene de Admin sala con un mesero seleccionado. */
  initialEmployeeId?: string | null;
}) {
  const { can } = useAuth();
  const { selectEmployee, selected, listMode, setListMode, employees } =
    useEmployees();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);

  const canManage = can("employees.manage");

  useEffect(() => {
    if (!open) return;
    if (initialEmployeeId) {
      setListMode("roster");
      selectEmployee(initialEmployeeId);
    }
  }, [open, initialEmployeeId, selectEmployee, setListMode]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Fichas del personal"
      description="Datos, jornada laboral, turnos y expediente (llamados de atención e incidencias)."
      className="flex max-h-[92vh] flex-col overflow-hidden"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                selectEmployee(null);
                setListMode(listMode === "history" ? "roster" : "history");
              }}
            >
              <History className="h-3.5 w-3.5" />
              {listMode === "history" ? "Equipo activo" : "Historial"}
            </Button>
            {canManage && listMode === "roster" ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!employees.length}
                  onClick={() => setShiftOpen(true)}
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Turno
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Nuevo
                </Button>
              </>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="grid min-h-[55vh] gap-3 overflow-hidden lg:grid-cols-[minmax(200px,260px)_1fr]">
        <div className="min-h-0 max-h-[60vh] overflow-y-auto">
          <EmployeeList />
        </div>
        <div className="min-h-0 max-h-[60vh] overflow-y-auto">
          <EmployeeDetail
            canManage={canManage}
            onEdit={() => {
              setEditing(true);
              setFormOpen(true);
            }}
          />
        </div>
      </div>

      <EmployeeFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(false);
        }}
        employee={editing && selected && !selected.deletedAt ? selected : null}
      />

      {listMode === "roster" ? (
        <ShiftFormModal
          open={shiftOpen}
          onClose={() => setShiftOpen(false)}
          defaultEmployeeId={selected?.id}
        />
      ) : null}
    </Modal>
  );
}
