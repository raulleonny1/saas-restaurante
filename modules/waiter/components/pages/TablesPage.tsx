"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { TableStatus } from "@/types/orders";
import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const STATUS: Record<TableStatus, { label: string; className: string }> = {
  available: {
    label: "Libre",
    className: "border-white/15 bg-white/5",
  },
  occupied: {
    label: "Ocupada",
    className: "border-emerald-600/50 bg-emerald-950/40",
  },
  reserved: {
    label: "Reservada",
    className: "border-sky-500/40 bg-sky-950/30",
  },
  dirty: {
    label: "Sucia",
    className: "border-amber-500/40 bg-amber-950/30",
  },
};

function TablesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const tableId = searchParams.get("table") || searchParams.get("tableId");
    if (!tableId || !tables.length) return;
    const exists = tables.some((t) => t.id === tableId);
    if (!exists) return;
    selectTable(tableId);
    router.replace("/waiter/pedido");
  }, [searchParams, tables, selectTable, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            Mesas
          </h1>
          <p className="text-sm text-[#a8b5a4]">Toca una mesa para tomar pedido.</p>
        </div>
        <Link
          href="/waiter/mover"
          className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs text-[#c5d0c2]"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" /> Mover
        </Link>
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
        {tables.map((table) => {
          const order =
            openOrders.find((o) => o.id === table.currentOrderId) ??
            openOrders.find((o) => o.tableId === table.id);
          const tone = STATUS[table.status];
          const selected = table.id === selectedTableId;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => {
                selectTable(table.id);
                router.push("/waiter/pedido");
              }}
              className={`min-h-[96px] rounded-2xl border p-3 text-left transition ${tone.className} ${
                selected ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-lg font-semibold">{table.name}</p>
                <span className="text-[10px] text-[#8fa08c]">{tone.label}</span>
              </div>
              <p className="mt-1 text-xs text-[#8fa08c]">{table.seats} pax</p>
              {order ? (
                <p className="mt-2 text-sm font-medium text-emerald-300">
                  {formatCurrency(order.total, currency)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#5a6b57]">Sin ticket</p>
              )}
            </button>
          );
        })}
      </div>

      {!tables.length ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#8fa08c]">
          No hay mesas. Ábrelas desde el POS (Preparar POS).
        </p>
      ) : null}
    </div>
  );
}

export function WaiterTablesPage() {
  return (
    <Suspense
      fallback={
        <p className="py-10 text-center text-sm text-[#8fa08c]">Cargando mesas…</p>
      }
    >
      <TablesContent />
    </Suspense>
  );
}
