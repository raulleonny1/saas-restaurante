"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { isWaiterOnlyRole } from "@/lib/roles";
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
  type TableFloorTone,
} from "@/modules/pos/domain/tableTone";
import type { Table } from "@/types/orders";
import { ArrowRightLeft, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const LEGEND: TableFloorTone[] = [
  "free",
  "occupied",
  "ordering",
  "sent",
];

function TablesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, user, role } = useAuth();
  const { restaurantId } = useRestaurant();
  const {
    tables,
    openOrders,
    selectedTableId,
    selectTable,
    currency,
    branches,
    branchId,
    setBranchId,
  } = usePos();
  const [manageOpen, setManageOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState<Table | null>(null);
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

  const visibleTables = useMemo(() => {
    if (!floorOnly) return tables;
    if (assignedTableIds === null) return [];
    if (assignedTableIds.length === 0) return [];
    return tables.filter((t) => assignedTableIds.includes(t.id));
  }, [floorOnly, tables, assignedTableIds]);

  useEffect(() => {
    const tableId = searchParams.get("table") || searchParams.get("tableId");
    if (!tableId || !visibleTables.length) return;
    const exists = visibleTables.find((t) => t.id === tableId);
    if (!exists) return;
    setPreviewTable(exists);
  }, [searchParams, visibleTables]);

  const previewOrder = previewTable
    ? orderForTable(previewTable, openOrders)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            Tu sala
          </h1>
          <p className="text-sm text-[#a8b5a4]">
            En cada mesa ves lo pedido y el total. Toca para la previa; luego
            entra al pedido si quieres.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageTables ? (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs text-[#c5d0c2]"
            >
              <Settings2 className="h-3.5 w-3.5" /> Gestionar
            </button>
          ) : null}
          <Link
            href="/waiter/mover"
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs text-[#c5d0c2]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Mover
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-[#a8b5a4]">
        {LEGEND.map((tone) => (
          <span
            key={tone}
            className={`rounded-full border px-2 py-0.5 ${TABLE_TONE_WAITER[tone]}`}
          >
            {TABLE_TONE_LABEL[tone]}
          </span>
        ))}
      </div>

      {branches.length > 1 ? (
        <select
          value={branchId ?? ""}
          onChange={(e) => setBranchId(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        {visibleTables.map((table) => {
          const order = orderForTable(table, openOrders);
          const tone = resolveTableFloorTone(table, order);
          const selected = table.id === selectedTableId;
          const zoneLabel = table.zone ? ` · ${table.zone}` : "";
          const lines = orderPreviewLines(order, 3);
          const elapsed = order
            ? formatElapsedShort(order.openedAt)
            : "";
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => setPreviewTable(table)}
              className={`min-h-[120px] rounded-2xl border p-3 text-left transition ${TABLE_TONE_WAITER[tone]} ${
                selected ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-lg font-semibold">{table.name}</p>
                <span className="text-[10px] text-[#c5d0c2]">
                  {TABLE_TONE_LABEL[tone]}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#8fa08c]">
                {table.seats} asientos
                {zoneLabel}
                {elapsed ? ` · ${elapsed}` : ""}
              </p>
              {lines.length ? (
                <ul className="mt-2 space-y-0.5">
                  {lines.map((line) => (
                    <li
                      key={line}
                      className="truncate text-[11px] leading-snug text-[#d5e0d2]"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[#5a6b57]">Sin pedidos</p>
              )}
              {order ? (
                <p className="mt-2 text-sm font-semibold text-white/95">
                  {formatCurrency(order.total, currency)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#5a6b57]">Sin ticket</p>
              )}
            </button>
          );
        })}
      </div>

      {!visibleTables.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#8fa08c]">
          {floorOnly ? (
            <>
              <p>No tienes mesas asignadas.</p>
              <p className="mt-2 text-xs">
                El administrador debe asignarte mesas en{" "}
                <strong>Admin sala</strong>.
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

      <TableOrderPreviewModal
        open={Boolean(previewTable)}
        onClose={() => {
          setPreviewTable(null);
          if (searchParams.get("table") || searchParams.get("tableId")) {
            router.replace("/waiter");
          }
        }}
        table={previewTable}
        order={previewOrder}
        currency={currency}
        tone="waiter"
        onEnter={() => {
          if (!previewTable) return;
          selectTable(previewTable.id);
          setPreviewTable(null);
          router.push("/waiter/pedido");
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
