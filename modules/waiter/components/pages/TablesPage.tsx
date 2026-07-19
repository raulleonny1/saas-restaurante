"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { isWaiterOnlyRole } from "@/lib/roles";
import { subscribeMyEmployeeAssignment } from "@/modules/employees/services/employees.service";
import { ManageTablesModal } from "@/modules/pos/components/ManageTablesModal";
import { usePos } from "@/modules/pos/context/PosProvider";
import {
  orderForTable,
  resolveTableFloorTone,
  TABLE_TONE_LABEL,
  TABLE_TONE_WAITER,
  type TableFloorTone,
} from "@/modules/pos/domain/tableTone";
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
    const exists = visibleTables.some((t) => t.id === tableId);
    if (!exists) return;
    selectTable(tableId);
    router.replace("/waiter/pedido");
  }, [searchParams, visibleTables, selectTable, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            Tu sala
          </h1>
          <p className="text-sm text-[#a8b5a4]">
            {floorOnly
              ? "Mesas que te asignó el administrador · toca para pedir."
              : "Vista completa · toca una mesa para pedir."}
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
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => {
                selectTable(table.id);
                router.push("/waiter/pedido");
              }}
              className={`min-h-[96px] rounded-2xl border p-3 text-left transition ${TABLE_TONE_WAITER[tone]} ${
                selected ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-lg font-semibold">{table.name}</p>
                <span className="text-[10px] text-[#c5d0c2]">
                  {TABLE_TONE_LABEL[tone]}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8fa08c]">
                {table.seats} asientos
                {zoneLabel}
              </p>
              {order ? (
                <p className="mt-2 text-sm font-medium text-white/90">
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
