"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { isSalaAdminRole, isWaiterOnlyRole } from "@/lib/roles";
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
import {
  LayoutGrid,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AdminPanel = "plano" | "camareros";

function zoneOf(t: Table): string {
  return (t.zone ?? "sala").toLowerCase();
}

function zoneLabel(z: string): string {
  if (z === "barra") return "Barra";
  if (z === "vip") return "VIP";
  if (z === "terraza") return "Terraza";
  return "Sala";
}

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

  const canManageTables = can("tables.manage");
  const canManageEmployees = can("employees.manage");

  const [panel, setPanel] = useState<AdminPanel>(() =>
    can("tables.manage") ? "plano" : "camareros",
  );
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [tablesReady, setTablesReady] = useState(false);
  const [manageTablesOpen, setManageTablesOpen] = useState(false);
  const [manageTablesTab, setManageTablesTab] = useState<"cantidad" | "una">(
    "cantidad",
  );
  const [waiterFormOpen, setWaiterFormOpen] = useState(false);
  const [fichasOpen, setFichasOpen] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);
  const [draftTableIds, setDraftTableIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const canAdmin =
    isSalaAdminRole(role) && (canManageTables || canManageEmployees);

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
  const floorCounts = useMemo(() => {
    const sala = activeTables.filter((t) => zoneOf(t) === "sala").length;
    const barra = activeTables.filter((t) => zoneOf(t) === "barra").length;
    const vip = activeTables.filter((t) => zoneOf(t) === "vip").length;
    const terraza = activeTables.filter((t) => zoneOf(t) === "terraza").length;
    return { sala, barra, vip, terraza, total: activeTables.length };
  }, [activeTables]);

  const waiters = useMemo(
    () =>
      employees.filter((e) => {
        if (e.deletedAt || e.status !== "active") return false;
        // Sala: camareros y cajeros (pueden atender mesas)
        if (isWaiterOnlyRole(e.roleId) || e.roleId === "cajero") return true;
        // Si alguien marcó mesas a un gerente/supervisor, también listarlo
        return (e.assignedTableIds?.length ?? 0) > 0;
      }),
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

  const tableOwners = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const w of waiters) {
      for (const tid of w.assignedTableIds ?? []) {
        const list = map.get(tid) ?? [];
        list.push({ id: w.id, name: w.name });
        map.set(tid, list);
      }
    }
    return map;
  }, [waiters]);

  const tablesByZone = useMemo(() => {
    const order = ["sala", "barra", "vip", "terraza"] as const;
    const labels: Record<string, string> = {
      sala: "Mesas de sala",
      barra: "Bares / barras",
      vip: "Sitios VIP",
      terraza: "Terraza",
    };
    const groups: { zone: string; label: string; tables: Table[] }[] = [];
    for (const z of order) {
      const rows = activeTables
        .filter((t) => zoneOf(t) === z)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (rows.length) {
        groups.push({ zone: z, label: labels[z] ?? z, tables: rows });
      }
    }
    return groups;
  }, [activeTables]);

  const unassignedCount = useMemo(
    () => activeTables.filter((t) => !(tableOwners.get(t.id)?.length)).length,
    [activeTables, tableOwners],
  );

  const draftDirty = useMemo(() => {
    if (!selectedWaiter) return false;
    const saved = [...(selectedWaiter.assignedTableIds ?? [])].sort().join("|");
    const draft = [...draftTableIds].sort().join("|");
    return saved !== draft;
  }, [selectedWaiter, draftTableIds]);

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

  function openCreateFloor(tab: "cantidad" | "una" = "cantidad") {
    setManageTablesTab(tab);
    setManageTablesOpen(true);
  }

  function toggleDraftTable(id: string) {
    setDraftTableIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectZone(zoneTables: Table[], mode: "all" | "none" | "free") {
    const ids = zoneTables.map((t) => t.id);
    const waiterId = selectedWaiter?.id;
    setDraftTableIds((prev) => {
      const set = new Set(prev);
      if (mode === "none") {
        for (const id of ids) set.delete(id);
        return [...set];
      }
      if (mode === "all") {
        for (const id of ids) set.add(id);
        return [...set];
      }
      for (const t of zoneTables) {
        const others = (tableOwners.get(t.id) ?? []).filter(
          (o) => o.id !== waiterId,
        );
        if (others.length === 0) set.add(t.id);
      }
      return [...set];
    });
  }

  function tableNamesFor(ids: string[] | undefined): string {
    if (!ids?.length) return "Sin mesas";
    const names = ids
      .map((id) => activeTables.find((t) => t.id === id)?.name)
      .filter(Boolean) as string[];
    if (!names.length) return `${ids.length} mesas`;
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }

  const navBtn =
    "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border px-3 py-3 text-left transition";

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        title="Administración de sala"
        description="Plano del local y zona de cada Camarero."
        actions={
          branches.length > 1 ? (
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
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Menú izquierdo: solo 2 acciones principales */}
        <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          {canManageTables ? (
            <button
              type="button"
              onClick={() => setPanel("plano")}
              className={`${navBtn} ${
                panel === "plano"
                  ? "border-accent bg-accent-soft/40 ring-1 ring-accent/30"
                  : "border-border hover:bg-bg-muted"
              }`}
            >
              <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">
                  Crear mesas
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">
                  Sala, bares, VIP · {floorCounts.total} sitios
                </span>
              </span>
            </button>
          ) : null}

          {canManageEmployees ? (
            <button
              type="button"
              onClick={() => setPanel("camareros")}
              className={`${navBtn} ${
                panel === "camareros"
                  ? "border-accent bg-accent-soft/40 ring-1 ring-accent/30"
                  : "border-border hover:bg-bg-muted"
              }`}
            >
              <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">
                  Ubicar camareros
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">
                  {waiters.length} en equipo
                  {unassignedCount
                    ? ` · ${unassignedCount} sin cubrir`
                    : ""}
                </span>
              </span>
            </button>
          ) : null}

          <div className="space-y-1 border-t border-border pt-3">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              Otros
            </p>
            {(can("catalog.products.manage") || can("catalog.read")) ? (
              <Link
                href="/inventory?tab=products"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <Package className="h-4 w-4" /> Carta / productos
              </Link>
            ) : null}
            <Link
              href="/settings?tab=printers"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <Printer className="h-4 w-4" /> Impresoras (Ajustes)
            </Link>
            <button
              type="button"
              onClick={() => setFichasOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <UsersRound className="h-4 w-4" /> Fichas de personal
            </button>
          </div>
        </aside>

        {/* Contenido: un solo panel */}
        <div className="min-w-0">
          {panel === "plano" ? (
            <section className="space-y-4 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Plano del local</h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    Crea las mesas, barras y VIP. Luego ubica a los Camareros.
                  </p>
                </div>
                {can("tables.manage") ? (
                  <Button onClick={() => openCreateFloor("cantidad")}>
                    <Plus className="h-4 w-4" />
                    Crear mesas / bares / VIP
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["Mesas", floorCounts.sala],
                    ["Bares", floorCounts.barra],
                    ["VIP", floorCounts.vip],
                    ["Terraza", floorCounts.terraza],
                  ] as const
                ).map(([label, n]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-muted/50 px-3 py-1 text-xs"
                  >
                    <span className="font-semibold tabular-nums">{n}</span>
                    {label}
                  </span>
                ))}
              </div>

              <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                {activeTables.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-caption">
                        {t.seats} asientos · {zoneLabel(zoneOf(t))}
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
                            !window.confirm(`¿Desactivar «${t.name}»?`)
                          ) {
                            return;
                          }
                          setBusy(true);
                          void deleteTable({ restaurantId, table: t })
                            .then(() => toast("Desactivada", "success"))
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
                  <li className="py-10 text-center text-sm text-fg-muted">
                    Aún no hay sitios. Pulsa «Crear mesas / bares / VIP».
                  </li>
                ) : null}
              </ul>

              {archivedTables.length ? (
                <div className="border-t border-border pt-3">
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
                              .then(() => toast("Reactivada", "success"))
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
          ) : null}

          {panel === "camareros" ? (
            <section className="space-y-4 rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    Ubicar camareros
                  </h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    Elige un Camarero y marca las mesas que le tocan. Solo verá
                    esas en /waiter.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unassignedCount > 0 ? (
                    <Badge tone="warning">{unassignedCount} sin cubrir</Badge>
                  ) : activeTables.length > 0 ? (
                    <Badge tone="success">Todas cubiertas</Badge>
                  ) : null}
                  {can("employees.manage") ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setWaiterFormOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Nuevo Camarero
                    </Button>
                  ) : null}
                </div>
              </div>

              {!activeTables.length ? (
                <Alert tone="warning" title="Falta el plano">
                  Primero crea mesas en «Crear mesas» (menú izquierdo).
                </Alert>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <ul className="max-h-[420px] space-y-2 overflow-y-auto">
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
                              ? "border-accent bg-accent-soft/40 ring-1 ring-accent/30"
                              : "border-border hover:bg-bg-muted"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{w.name}</p>
                            <Badge tone={n ? "success" : "warning"}>
                              {n || 0}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-fg-muted">
                            {tableNamesFor(w.assignedTableIds)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                  {!waiters.length ? (
                    <li className="py-6 text-center text-sm text-fg-muted">
                      No hay Camareros. Crea uno.
                    </li>
                  ) : null}
                </ul>

                <div className="min-w-0">
                  {!selectedWaiter ? (
                    <div className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-12 text-center text-sm text-fg-muted">
                      Selecciona un Camarero a la izquierda.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm">
                        Zona de <strong>{selectedWaiter.name}</strong>
                      </p>

                      {tablesByZone.map((group) => {
                        const selectedInZone = group.tables.filter((t) =>
                          draftTableIds.includes(t.id),
                        ).length;
                        return (
                          <div key={group.zone}>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                                {group.label}{" "}
                                <span className="font-normal normal-case">
                                  · {selectedInZone}/{group.tables.length}
                                </span>
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!can("employees.manage")}
                                  onClick={() =>
                                    selectZone(group.tables, "all")
                                  }
                                >
                                  Toda
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!can("employees.manage")}
                                  onClick={() =>
                                    selectZone(group.tables, "free")
                                  }
                                >
                                  Libres
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!can("employees.manage")}
                                  onClick={() =>
                                    selectZone(group.tables, "none")
                                  }
                                >
                                  Ninguna
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                              {group.tables.map((t) => {
                                const checked = draftTableIds.includes(t.id);
                                const others = (
                                  tableOwners.get(t.id) ?? []
                                ).filter((o) => o.id !== selectedWaiter.id);
                                const shared = others.length > 0;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    disabled={!can("employees.manage")}
                                    onClick={() => toggleDraftTable(t.id)}
                                    className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition ${
                                      checked
                                        ? "border-accent bg-accent text-white"
                                        : shared
                                          ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20"
                                          : "border-border hover:bg-bg-muted"
                                    }`}
                                  >
                                    <p className="font-medium">{t.name}</p>
                                    <p
                                      className={`text-[11px] ${
                                        checked
                                          ? "text-white/80"
                                          : "text-fg-muted"
                                      }`}
                                    >
                                      {shared
                                        ? `también ${others[0]?.name}`
                                        : checked
                                          ? "suya"
                                          : "libre"}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                        <Button
                          disabled={
                            busy || !can("employees.manage") || !draftDirty
                          }
                          onClick={() => {
                            setBusy(true);
                            void assignTables(
                              selectedWaiter.id,
                              draftTableIds,
                            )
                              .then(() =>
                                toast(
                                  `${selectedWaiter.name}: ${draftTableIds.length} sitios`,
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
                          {busy
                            ? "Guardando…"
                            : draftDirty
                              ? "Guardar zona"
                              : "Guardado"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || !can("employees.manage")}
                          onClick={() => setDraftTableIds([])}
                        >
                          Quitar todas
                        </Button>
                        {can("employees.manage") ? (
                          <Button
                            variant="danger"
                            size="sm"
                            className="ml-auto"
                            disabled={busy}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `¿Eliminar a ${selectedWaiter.name}?`,
                                )
                              ) {
                                return;
                              }
                              setBusy(true);
                              void archive(selectedWaiter.id)
                                .then(() => {
                                  toast("Camarero archivado", "success");
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
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <ManageTablesModal
        open={manageTablesOpen}
        initialTab={manageTablesTab}
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
