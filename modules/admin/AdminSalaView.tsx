"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { isSalaAdminRole } from "@/lib/roles";
import { EmployeeFichasModal } from "@/modules/employees/components/EmployeeFichasModal";
import { EmployeeFormModal } from "@/modules/employees/components/EmployeeFormModal";
import {
  EmployeesProvider,
  useEmployees,
} from "@/modules/employees/context/EmployeesProvider";
import { ManageTablesModal } from "@/modules/pos/components/ManageTablesModal";
import { PosProvider, usePos } from "@/modules/pos/context/PosProvider";
import {
  deleteTable,
  restoreTable,
  subscribeAllTables,
} from "@/modules/pos/services/tables.service";
import type { Employee } from "@/types/employees";
import type { Table } from "@/types/orders";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Skeleton,
  toast,
} from "@/ui";
import { Plus, RotateCcw, Settings2, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function AdminSalaWorkspace() {
  const { can, role } = useAuth();
  const { restaurantId } = useRestaurant();
  const { branches } = useTenant();
  const { branchId, setBranchId } = usePos();
  const {
    employees,
    archive,
    assignTables,
    ready: empReady,
  } = useEmployees();

  const [allTables, setAllTables] = useState<Table[]>([]);
  const [tablesReady, setTablesReady] = useState(false);
  const [manageTablesOpen, setManageTablesOpen] = useState(false);
  const [waiterFormOpen, setWaiterFormOpen] = useState(false);
  const [fichasOpen, setFichasOpen] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);
  const [draftTableIds, setDraftTableIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const canAdmin =
    isSalaAdminRole(role) &&
    (can("tables.manage") || can("employees.manage"));

  useEffect(() => {
    if (!restaurantId || !branchId) {
      setAllTables([]);
      setTablesReady(true);
      return;
    }
    setTablesReady(false);
    return subscribeAllTables(
      restaurantId,
      branchId,
      (rows) => {
        setAllTables(rows);
        setTablesReady(true);
      },
      () => setTablesReady(true),
    );
  }, [restaurantId, branchId]);

  const activeTables = useMemo(
    () => allTables.filter((t) => !t.deletedAt),
    [allTables],
  );
  const archivedTables = useMemo(
    () => allTables.filter((t) => Boolean(t.deletedAt)),
    [allTables],
  );

  const waiters = useMemo(
    () =>
      employees.filter(
        (e) =>
          !e.deletedAt &&
          (e.roleId === "mesero" || e.roleId === "cajero") &&
          e.status === "active",
      ),
    [employees],
  );

  const selectedWaiter: Employee | null =
    waiters.find((w) => w.id === selectedWaiterId) ?? null;

  useEffect(() => {
    if (!selectedWaiter) {
      setDraftTableIds([]);
      return;
    }
    setDraftTableIds(selectedWaiter.assignedTableIds ?? []);
  }, [selectedWaiter]);

  if (!empReady || !tablesReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[50vh] w-full" />
      </div>
    );
  }

  if (!canAdmin) {
    return (
      <Alert tone="warning" title="Sin acceso de administrador de sala">
        Necesitas rol gerente/supervisor/dueño con permisos de mesas o empleados.
      </Alert>
    );
  }

  function toggleDraftTable(id: string) {
    setDraftTableIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Administración de sala"
        description="Activa mesas, da de alta meseros y asígnales las mesas que deben atender."
        actions={
          <div className="flex flex-wrap gap-2">
            {branches.length > 1 ? (
              <select
                className="rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 py-2 text-sm"
                value={branchId ?? ""}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Badge tone="accent">{activeTables.length} mesas activas</Badge>
            <Badge tone="neutral">{waiters.length} meseros</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mesas */}
        <section className="rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Mesas y barras</h2>
            {can("tables.manage") ? (
              <Button size="sm" onClick={() => setManageTablesOpen(true)}>
                <Settings2 className="h-3.5 w-3.5" /> Gestionar
              </Button>
            ) : null}
          </div>
          <ul className="max-h-[320px] space-y-2 overflow-y-auto">
            {activeTables.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-caption">
                    {t.seats} asientos · {t.zone ?? "sala"} · {t.status}
                  </p>
                </div>
                {can("tables.manage") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (!restaurantId) return;
                      if (
                        !window.confirm(`¿Desactivar la mesa «${t.name}»?`)
                      ) {
                        return;
                      }
                      setBusy(true);
                      void deleteTable({ restaurantId, table: t })
                        .then(() => toast("Mesa desactivada", "success"))
                        .catch((e) =>
                          toast(
                            e instanceof Error ? e.message : "Error",
                            "error",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
            {!activeTables.length ? (
              <li className="py-6 text-center text-sm text-fg-muted">
                No hay mesas activas. Pulsa Gestionar para crearlas.
              </li>
            ) : null}
          </ul>
          {archivedTables.length ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs text-fg-muted">Desactivadas</p>
              <ul className="space-y-1">
                {archivedTables.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between text-sm text-fg-muted"
                  >
                    <span>{t.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || !restaurantId}
                      onClick={() => {
                        if (!restaurantId) return;
                        setBusy(true);
                        void restoreTable({
                          restaurantId,
                          tableId: t.id,
                        })
                          .then(() => toast("Mesa reactivada", "success"))
                          .catch((e) =>
                            toast(
                              e instanceof Error ? e.message : "Error",
                              "error",
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Activar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Meseros */}
        <section className="rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Meseros / cajeros</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setFichasOpen(true)}
              >
                <UsersRound className="h-3.5 w-3.5" /> Fichas
              </Button>
              {can("employees.manage") ? (
                <Button size="sm" onClick={() => setWaiterFormOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo mesero
                </Button>
              ) : null}
            </div>
          </div>
          <ul className="max-h-[320px] space-y-2 overflow-y-auto">
            {waiters.map((w) => {
              const n = w.assignedTableIds?.length ?? 0;
              const selected = w.id === selectedWaiterId;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedWaiterId(w.id)}
                    className={`w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-accent bg-accent-soft/40"
                        : "border-border hover:bg-bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{w.name}</p>
                      <Badge tone={n ? "success" : "warning"}>
                        {n ? `${n} mesas` : "Sin mesas"}
                      </Badge>
                    </div>
                    <p className="text-caption">
                      {w.roleId} · {w.email}
                    </p>
                  </button>
                </li>
              );
            })}
            {!waiters.length ? (
              <li className="py-6 text-center text-sm text-fg-muted">
                No hay meseros. Crea uno o ve a Empleados.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {/* Asignación */}
      <section className="rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
        <h2 className="text-sm font-medium">Asignar mesas al camarero</h2>
        {!selectedWaiter ? (
          <p className="mt-3 text-sm text-fg-muted">
            Selecciona un mesero a la derecha para marcar las mesas que debe
            atender.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-fg-muted">
              Mesas para <strong>{selectedWaiter.name}</strong>. Solo verá
              estas en su app (/waiter).
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {activeTables.map((t) => {
                const checked = draftTableIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm ${
                      checked
                        ? "border-accent bg-accent-soft/40"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraftTable(t.id)}
                    />
                    <span>
                      {t.name}
                      <span className="block text-[11px] text-fg-muted">
                        {t.seats} asientos
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {!activeTables.length ? (
              <p className="mt-3 text-sm text-fg-muted">
                Primero crea mesas activas.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busy || !can("employees.manage")}
                onClick={() => {
                  setBusy(true);
                  void assignTables(selectedWaiter.id, draftTableIds)
                    .then(() =>
                      toast(
                        `Mesas asignadas a ${selectedWaiter.name}`,
                        "success",
                      ),
                    )
                    .catch((e) =>
                      toast(e instanceof Error ? e.message : "Error", "error"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Guardar asignación
              </Button>
              {can("employees.manage") ? (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `¿Eliminar a ${selectedWaiter.name} del equipo?`,
                      )
                    ) {
                      return;
                    }
                    setBusy(true);
                    void archive(selectedWaiter.id)
                      .then(() => {
                        toast("Mesero archivado", "success");
                        setSelectedWaiterId(null);
                      })
                      .catch((e) =>
                        toast(
                          e instanceof Error ? e.message : "Error",
                          "error",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Eliminar mesero
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>

      <ManageTablesModal
        open={manageTablesOpen}
        onClose={() => setManageTablesOpen(false)}
      />
      <EmployeeFormModal
        open={waiterFormOpen}
        onClose={() => setWaiterFormOpen(false)}
        employee={null}
      />
      <EmployeeFichasModal
        open={fichasOpen}
        onClose={() => setFichasOpen(false)}
        initialEmployeeId={selectedWaiterId}
      />
    </div>
  );
}

export function AdminSalaView() {
  return (
    <PosProvider>
      <EmployeesProvider>
        <AdminSalaWorkspace />
      </EmployeesProvider>
    </PosProvider>
  );
}
