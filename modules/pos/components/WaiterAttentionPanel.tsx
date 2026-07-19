"use client";

import { formatCurrency } from "@/lib/format";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import { orderForTable } from "@/modules/pos/domain/tableTone";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Employee } from "@/types/employees";
import type { Order, OrderItem } from "@/types/orders";
import { Badge, Button } from "@/ui";
import { ArrowLeft, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function formatElapsed(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
}

function itemTime(item: OrderItem, order: Order): string {
  return item.sentAt ?? order.sentAt ?? order.openedAt;
}

function activeItems(order: Order): OrderItem[] {
  return (order.items ?? []).filter((i) => i.status !== "cancelled");
}

export function WaiterAttentionPanel() {
  const { employees } = useEmployees();
  const {
    tables,
    openOrders,
    selectTable,
    currency,
    branchId,
  } = usePos();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Refrescar “hace X min” cada 30s
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const waiters = useMemo(
    () =>
      employees.filter(
        (e) =>
          !e.deletedAt &&
          e.status === "active" &&
          (e.roleId === "mesero" || e.roleId === "cajero"),
      ),
    [employees],
  );

  const floorTables = useMemo(
    () => tables.filter((t) => !t.deletedAt),
    [tables],
  );

  const rows = useMemo(() => {
    function ordersForWaiter(w: Employee): Order[] {
      const assigned = new Set(w.assignedTableIds ?? []);
      const byTable = floorTables
        .filter((t) => assigned.has(t.id))
        .map((t) => orderForTable(t, openOrders))
        .filter((o): o is Order => Boolean(o));

      const byUid = w.uid
        ? openOrders.filter(
            (o) =>
              (o.servedBy === w.uid || o.createdBy === w.uid) &&
              (!branchId || o.branchId === branchId),
          )
        : [];

      const map = new Map<string, Order>();
      for (const o of [...byTable, ...byUid]) map.set(o.id, o);
      return [...map.values()].sort((a, b) =>
        (a.openedAt ?? "").localeCompare(b.openedAt ?? ""),
      );
    }

    return waiters.map((w) => {
      const orders = ordersForWaiter(w);
      const itemCount = orders.reduce(
        (n, o) => n + activeItems(o).length,
        0,
      );
      return { waiter: w, orders, itemCount };
    });
  }, [waiters, floorTables, openOrders, branchId, now]);

  const selected = rows.find((r) => r.waiter.id === selectedId) ?? null;

  if (selected) {
    const { waiter, orders } = selected;
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Meseros
            </Button>
            <h2 className="mt-1 text-lg font-medium">{waiter.name}</h2>
            <p className="text-caption text-fg-muted">
              {waiter.roleId} · {waiter.email}
              {waiter.assignedTableIds?.length
                ? ` · ${waiter.assignedTableIds.length} mesas asignadas`
                : " · sin mesas asignadas"}
            </p>
          </div>
          <Badge tone={orders.length ? "accent" : "neutral"}>
            {orders.length} en atención
          </Badge>
        </div>

        {!orders.length ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border py-10 text-center text-sm text-fg-muted">
            Este mesero no tiene pedidos abiertos ahora.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {orders.map((order) => {
              const items = activeItems(order);
              const tableLabel =
                order.tableName ??
                floorTables.find((t) => t.id === order.tableId)?.name ??
                "Mesa";
              return (
                <li
                  key={order.id}
                  className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{tableLabel}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-caption text-fg-muted">
                        <Clock className="h-3 w-3" />
                        Pedido {formatElapsed(order.openedAt)}
                        {order.sentAt
                          ? ` · cocina ${formatElapsed(order.sentAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{order.status}</Badge>
                      <span className="text-sm font-medium">
                        {formatCurrency(order.total, currency)}
                      </span>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p>
                            <span className="font-medium">{item.quantity}×</span>{" "}
                            {item.name}
                            {item.variantName ? (
                              <span className="text-fg-muted">
                                {" "}
                                ({item.variantName})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-fg-muted">
                            {item.status}
                            {" · "}
                            {formatElapsed(itemTime(item, order))}
                          </p>
                        </div>
                        <span className="shrink-0 text-caption">
                          {formatCurrency(
                            item.unitPrice * item.quantity,
                            currency,
                          )}
                        </span>
                      </li>
                    ))}
                    {!items.length ? (
                      <li className="text-sm text-fg-muted">
                        Mesa abierta sin líneas aún.
                      </li>
                    ) : null}
                  </ul>

                  {order.tableId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => selectTable(order.tableId!)}
                    >
                      Abrir en ticket
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-fg-muted">Meseros en sala</h2>
        <p className="mt-0.5 text-caption text-fg-muted">
          Pulsa un mesero para ver qué atiende, qué han pedido los clientes y
          hace cuánto.
        </p>
      </div>

      {!rows.length ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border py-10 text-center text-sm text-fg-muted">
          No hay meseros activos. Dales de alta en Admin sala / Empleados.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rows.map(({ waiter, orders, itemCount }) => (
            <li key={waiter.id}>
              <button
                type="button"
                onClick={() => setSelectedId(waiter.id)}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-3 text-left transition hover:border-accent/40 hover:bg-bg-muted"
              >
                <div className="min-w-0">
                  <p className="font-medium">{waiter.name}</p>
                  <p className="text-caption text-fg-muted">
                    {(waiter.assignedTableIds?.length ?? 0) > 0
                      ? `${waiter.assignedTableIds!.length} mesas asignadas`
                      : "Sin mesas asignadas"}
                    {itemCount ? ` · ${itemCount} ítems en curso` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={orders.length ? "success" : "neutral"}>
                    {orders.length} mesa{orders.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
