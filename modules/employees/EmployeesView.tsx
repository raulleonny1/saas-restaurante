"use client";

import { useAuth } from "@/context/AuthProvider";
import { EmployeeDetail } from "@/modules/employees/components/EmployeeDetail";
import { EmployeeFormModal } from "@/modules/employees/components/EmployeeFormModal";
import { EmployeeList } from "@/modules/employees/components/EmployeeList";
import { ShiftFormModal } from "@/modules/employees/components/ShiftFormModal";
import {
  EmployeesProvider,
  useEmployees,
} from "@/modules/employees/context/EmployeesProvider";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Skeleton,
  toast,
} from "@/ui";
import { ArrowLeft, CalendarPlus, History, Plus, UsersRound } from "lucide-react";
import { useState } from "react";

function EmployeesWorkspace() {
  const { can } = useAuth();
  const {
    ready,
    error,
    employees,
    archivedEmployees,
    listMode,
    setListMode,
    selectEmployee,
    shifts,
    importFromMembers,
    selected,
  } = useEmployees();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const canRead = can("employees.read") || can("employees.manage");
  const canManage = can("employees.manage");

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <Alert tone="warning" title="Sin acceso a Empleados">
        Tu rol no tiene permiso `employees.read`.
      </Alert>
    );
  }

  const active = employees.filter((e) => e.status === "active").length;
  const inHistory = listMode === "history";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-16 lg:pb-0">
      <PageHeader
        title={inHistory ? "Historial de empleados" : "Empleados"}
        description={
          inHistory
            ? "Empleados eliminados del equipo. Puedes consultar su ficha y turnos, o restaurarlos."
            : "Equipo activo, roles, sucursales y turnos. Eliminar mueve al historial (no borra del todo)."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {!inHistory ? (
              <>
                <Badge tone="accent">{active} activos</Badge>
                <Badge tone="neutral">{shifts.length} turnos</Badge>
                {archivedEmployees.length ? (
                  <Badge tone="neutral">
                    {archivedEmployees.length} en historial
                  </Badge>
                ) : null}
              </>
            ) : (
              <Badge tone="neutral">
                {archivedEmployees.length} en historial
              </Badge>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                selectEmployee(null);
                setListMode(inHistory ? "roster" : "history");
              }}
            >
              {inHistory ? (
                <>
                  <ArrowLeft className="h-4 w-4" /> Volver al equipo
                </>
              ) : (
                <>
                  <History className="h-4 w-4" /> Historial
                  {archivedEmployees.length
                    ? ` (${archivedEmployees.length})`
                    : ""}
                </>
              )}
            </Button>
            {canManage && !inHistory ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={importing}
                  onClick={() => {
                    void (async () => {
                      try {
                        setImporting(true);
                        const n = await importFromMembers();
                        toast(
                          n
                            ? `${n} empleado(s) importados desde membresías`
                            : "Nada nuevo que importar",
                          "success",
                        );
                      } catch (e) {
                        toast(
                          e instanceof Error ? e.message : "Error",
                          "error",
                        );
                      } finally {
                        setImporting(false);
                      }
                    })();
                  }}
                >
                  <UsersRound className="h-4 w-4" /> Importar membresías
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShiftOpen(true)}
                  disabled={!employees.length}
                >
                  <CalendarPlus className="h-4 w-4" /> Turno
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Nuevo
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <EmployeeList />
        <EmployeeDetail
          canManage={canManage}
          onEdit={() => {
            setEditing(true);
            setFormOpen(true);
          }}
        />
      </div>

      <EmployeeFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(false);
        }}
        employee={editing && selected && !selected.deletedAt ? selected : null}
      />

      {!inHistory ? (
        <ShiftFormModal
          open={shiftOpen}
          onClose={() => setShiftOpen(false)}
          defaultEmployeeId={selected?.id}
        />
      ) : null}
    </div>
  );
}

export function EmployeesView() {
  return (
    <EmployeesProvider>
      <EmployeesWorkspace />
    </EmployeesProvider>
  );
}
