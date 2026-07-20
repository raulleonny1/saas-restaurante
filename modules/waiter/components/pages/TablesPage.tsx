"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { isWaiterOnlyRole } from "@/lib/roles";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { subscribeMyEmployeeAssignment } from "@/modules/employees/services/employees.service";
import { ManageTablesModal } from "@/modules/pos/components/ManageTablesModal";
import { TableOrderPreviewModal } from "@/modules/pos/components/TableOrderPreviewModal";
import { usePos } from "@/modules/pos/context/PosProvider";
import {
  formatElapsedShort,
  orderPreviewLines,
} from "@/modules/pos/domain/orderPreview";
import {
  orderForTable,
  resolveTableFloorTone,
  TABLE_TONE_LABEL,
  TABLE_TONE_WAITER,
  TABLE_TONE_WAITER_LEGEND,
  TABLE_TONE_WAITER_LIVE,
  type TableFloorTone,
} from "@/modules/pos/domain/tableTone";
import type { Order, Table } from "@/types/orders";
import { ArrowRightLeft, HandHelping, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const LEGEND: TableFloorTone[] = [
  "free",
  "occupied",
  "ordering",
  "sent",
  "ready",
  "dirty",
];

const TONE_DOT: Record<TableFloorTone, string> = {
  free: "bg-[#8fa08c]",
  occupied: "bg-red-400",
  ordering: "bg-amber-400",
  sent: "bg-emerald-400",
  ready: "bg-cyan-400",
  reserved: "bg-sky-400",
  dirty: "bg-stone-400",
};

function tableNeedsCover(_table: Table, order: Order | null): boolean {
  // Solo mesas con líneas reales (no vacías ni fantasma).
  if (!order || order.status === "paid" || order.status === "cancelled") {
    return false;
  }
  return order.items.some((i) => i.status !== "cancelled");
}

function TableCard({
  table,
  order,
  selected,
  currency,
  cover,
  onOpen,
}: {
  table: Table;
  order: Order | null;
  selected: boolean;
  currency: string;
  cover?: boolean;
  onOpen: () => void;
}) {
  const tone = resolveTableFloorTone(table, order);
  const zoneLabel = table.zone ? ` · ${table.zone}` : "";
  const lines = orderPreviewLines(order, 3);
  const elapsed = order ? formatElapsedShort(order.openedAt) : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative min-h-[132px] overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-[transform,box-shadow] active:scale-[0.98] ${
        TABLE_TONE_WAITER_LIVE[tone] ?? TABLE_TONE_WAITER[tone]
      } ${
        selected
          ? "ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-[#0e1410]"
          : "hover:shadow-md hover:shadow-black/20"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${TONE_DOT[tone]}`}
      />
      <div className="flex items-start justify-between gap-1 pl-1.5">
        <p className="font-[family-name:var(--font-display)] text-xl leading-none tracking-tight">
          {table.name}
        </p>
        <div className="flex flex-col items-end gap-1">
          {cover ? (
            <span className="rounded-full border border-amber-400/40 bg-amber-950/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
              Cobertura
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-medium text-[#d5e0d2]">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
            {TABLE_TONE_LABEL[tone]}
          </span>
        </div>
      </div>
      <p className="mt-1.5 pl-1.5 text-[11px] text-[#8fa08c]">
        {table.seats} asientos
        {zoneLabel}
        {elapsed ? ` · ${elapsed}` : ""}
      </p>
      {lines.length ? (
        <ul className="mt-2.5 space-y-0.5 pl-1.5">
          {lines.map((line) => (
            <li
              key={line}
              className="truncate text-[11px] leading-snug text-[#d5e0d2]/95"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 pl-1.5 text-xs text-[#5a6b57]">
          {tone === "dirty" ? "Toca · marcar limpia" : "Sin pedidos"}
        </p>
      )}
      {order ? (
        <p className="mt-2.5 pl-1.5 text-base font-semibold tabular-nums tracking-tight text-white">
          {formatCurrency(order.total, currency)}
        </p>
      ) : (
        <p className="mt-2.5 pl-1.5 text-xs text-[#5a6b57]">
          {tone === "dirty" ? "Tras cobro" : "Sin ticket"}
        </p>
      )}
    </button>
  );
}

function TablesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, user, role } = useAuth();
  const routes = useFloorRoutes();
  const { restaurantId } = useRestaurant();
  const {
    ready,
    tables,
    openOrders,
    selectedTableId,
    selectTable,
    currency,
    branches,
    branchId,
    setBranchId,
    markTableClean,
    releaseIdleTables,
  } = usePos();
  const [manageOpen, setManageOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState<Table | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [assignedTableIds, setAssignedTableIds] = useState<string[] | null>(
    null,
  );
  const canManageTables = can("tables.manage");
  const floorOnly = isWaiterOnlyRole(role);

  const waiterUid = user?.uid;
  const waiterEmail = user?.email;
  useEffect(() => {
    if (!floorOnly || !restaurantId || !waiterUid || !waiterEmail) {
      setAssignedTableIds(null);
      return;
    }
    return subscribeMyEmployeeAssignment(
      restaurantId,
      waiterUid,
      waiterEmail,
      setAssignedTableIds,
    );
  }, [floorOnly, restaurantId, waiterUid, waiterEmail]);

  // Al entrar a sala: libera mesas abiertas sin consumición y fantasmas.
  useEffect(() => {
    if (!ready) return;
    void releaseIdleTables();
  }, [ready, releaseIdleTables]);

  const assignedSet = useMemo(
    () => new Set(assignedTableIds ?? []),
    [assignedTableIds],
  );

  const visibleTables = useMemo(() => {
    if (!floorOnly) return tables;
    if (assignedTableIds === null) return [];
    if (assignedTableIds.length === 0) return [];
    return tables.filter((t) => assignedSet.has(t.id));
  }, [floorOnly, tables, assignedTableIds, assignedSet]);

  const coverTables = useMemo(() => {
    if (!floorOnly) return [];
    if (assignedTableIds === null) return [];
    return tables.filter((t) => {
      if (assignedSet.has(t.id)) return false;
      const order = orderForTable(t, openOrders);
      return tableNeedsCover(t, order);
    });
  }, [floorOnly, tables, assignedTableIds, assignedSet, openOrders]);

  useEffect(() => {
    const tableId = searchParams.get("table") || searchParams.get("tableId");
    if (!tableId) return;
    const mine = visibleTables.find((t) => t.id === tableId);
    if (mine) {
      setPreviewTable(mine);
      return;
    }
    const cover = coverTables.find((t) => t.id === tableId);
    if (cover) {
      setCoverOpen(true);
      setPreviewTable(cover);
    }
  }, [searchParams, visibleTables, coverTables]);

  const previewOrder = previewTable
    ? orderForTable(previewTable, openOrders)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
            Tu sala
          </h1>
          <p className="mt-1 max-w-[20rem] text-sm leading-snug text-[#a8b5a4]">
            Toca una mesa para ver el ticket. Para ayudar a un compañero usa{" "}
            <span className="font-medium text-[#e7efe4]">Cubrir</span>.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canManageTables ? (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-xs font-medium text-[#c5d0c2]"
            >
              <Settings2 className="h-3.5 w-3.5" /> Gestionar
            </button>
          ) : null}
          <Link
            href={routes.move}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-xs font-medium text-[#c5d0c2]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Mover
          </Link>
        </div>
      </div>

      {floorOnly ? (
        <button
          type="button"
          onClick={() => setCoverOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-sm transition ${
            coverOpen
              ? "border-amber-400/50 bg-gradient-to-r from-amber-950/70 to-amber-900/40 text-amber-50"
              : "border-amber-500/25 bg-amber-950/30 text-amber-100"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <HandHelping className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">
                Cubrir a un compañero
              </span>
              <span className="block text-[11px] text-amber-100/70">
                {coverTables.length > 0
                  ? `${coverTables.length} mesa${coverTables.length === 1 ? "" : "s"} ajena${coverTables.length === 1 ? "" : "s"} con servicio`
                  : "Ver mesas de otros (si hay servicio activo)"}
              </span>
            </span>
          </span>
          <span className="rounded-full bg-amber-500/25 px-3 py-1.5 text-xs font-semibold">
            {coverOpen ? "Ocultar" : "Abrir"}
          </span>
        </button>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {LEGEND.map((tone) => (
          <span
            key={tone}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium text-[#c5d0c2] ${TABLE_TONE_WAITER_LEGEND[tone]}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
            {TABLE_TONE_LABEL[tone]}
          </span>
        ))}
      </div>

      {branches.length > 1 ? (
        <select
          value={branchId ?? ""}
          onChange={(e) => setBranchId(e.target.value)}
          className="w-full rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-3 text-sm"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8fa08c]">
          Mis mesas
        </h2>
        <span className="text-[11px] text-[#5a6b57]">
          {visibleTables.length} mesa{visibleTables.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleTables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            order={orderForTable(table, openOrders)}
            selected={table.id === selectedTableId}
            currency={currency}
            onOpen={() => setPreviewTable(table)}
          />
        ))}
      </div>

      {!visibleTables.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-[#8fa08c]">
          {floorOnly ? (
            <>
              <p className="font-medium text-[#a8b5a4]">
                No tienes mesas asignadas.
              </p>
              <p className="mt-2 text-xs leading-relaxed">
                El administrador debe asignarte mesas en{" "}
                <strong className="text-[#c5d0c2]">Admin sala</strong>.
                {coverTables.length > 0
                  ? " Mientras, puedes usar Cubrir para ayudar."
                  : ""}
              </p>
            </>
          ) : (
            <>
              <p>No hay mesas en esta sucursal.</p>
              {canManageTables ? (
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="mt-3 text-emerald-400 underline-offset-2 hover:underline"
                >
                  Crear mesas y barras
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {floorOnly && coverOpen ? (
        <div className="space-y-3 border-t border-amber-500/15 pt-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/90">
              Otras mesas · cobertura
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-[#8fa08c]">
              Mesas de compañeros con servicio. Entras solo a ayudar; no se
              quedan asignadas a ti.
            </p>
          </div>
          {coverTables.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {coverTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  order={orderForTable(table, openOrders)}
                  selected={table.id === selectedTableId}
                  currency={currency}
                  cover
                  onOpen={() => setPreviewTable(table)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-amber-500/25 bg-amber-950/20 p-6 text-center text-sm text-[#a8b5a4]">
              Ahora no hay mesas ajenas con pedido o ocupadas. Cuando un
              compañero tenga servicio, aparecerán aquí.
            </div>
          )}
        </div>
      ) : null}

      <TableOrderPreviewModal
        open={Boolean(previewTable)}
        onClose={() => {
          setPreviewTable(null);
          if (searchParams.get("table") || searchParams.get("tableId")) {
            router.replace(routes.home);
          }
        }}
        table={previewTable}
        order={previewOrder}
        currency={currency}
        tone="waiter"
        onMarkClean={
          previewTable
            ? async () => {
                await markTableClean(previewTable.id);
              }
            : undefined
        }
        onEnter={() => {
          if (!previewTable) return;
          selectTable(previewTable.id);
          setPreviewTable(null);
          router.push(routes.order);
        }}
      />

      <ManageTablesModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}

export function WaiterTablesPage() {
  return (
    <Suspense
      fallback={
        <p className="py-10 text-center text-sm text-[#8fa08c]">
          Cargando mesas…
        </p>
      }
    >
      <TablesContent />
    </Suspense>
  );
}
