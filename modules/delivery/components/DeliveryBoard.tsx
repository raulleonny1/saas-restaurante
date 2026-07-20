"use client";

import { formatCurrency } from "@/lib/format";
import {
  deliveryStatusLabel,
  useDelivery,
} from "@/modules/delivery/context/DeliveryProvider";
import type { DeliveryStatus, Order } from "@/types/orders";
import { Alert, Badge, Button, Select, toast } from "@/ui";
import { useMemo } from "react";

const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  preparing: "ready",
  ready: "assigned",
  assigned: "en_route",
  en_route: "delivered",
};

const NEXT_LABEL: Partial<Record<DeliveryStatus, string>> = {
  preparing: "Marcar listo",
  ready: "Asignarme",
  assigned: "En camino",
  en_route: "Entregado",
};

export function DeliveryBoard() {
  const {
    ready,
    error,
    orders,
    branches,
    branchId,
    setBranchId,
    currency,
    assignToMe,
    advance,
  } = useDelivery();

  const grouped = useMemo(() => {
    const buckets: Record<string, Order[]> = {
      ready: [],
      assigned: [],
      en_route: [],
      other: [],
    };
    for (const o of orders) {
      const s = o.deliveryStatus || "preparing";
      if (s === "ready" || (!o.deliveryStatus && o.status === "ready")) {
        buckets.ready.push(o);
      } else if (s === "assigned") buckets.assigned.push(o);
      else if (s === "en_route") buckets.en_route.push(o);
      else buckets.other.push(o);
    }
    return buckets;
  }, [orders]);

  if (!ready) {
    return <p className="p-6 text-sm text-[#8fa08c]">Cargando repartos…</p>;
  }

  async function onAction(order: Order) {
    const status = (order.deliveryStatus ||
      (order.status === "ready" ? "ready" : "preparing")) as DeliveryStatus;
    try {
      if (status === "ready" || (!order.deliveryAssignedTo && status === "preparing")) {
        if (status === "ready" || order.status === "ready") {
          await assignToMe(order);
          toast("Pedido asignado", "success");
          return;
        }
      }
      const next = NEXT[status];
      if (!next) return;
      if (next === "assigned") {
        await assignToMe(order);
      } else {
        await advance(order, next);
      }
      toast(deliveryStatusLabel(next), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#e7efe4]">
          Repartos
        </h1>
        <p className="text-sm text-[#8fa08c]">
          Pedidos delivery / takeaway · estados hasta entrega
        </p>
      </header>

      {error ? (
        <Alert tone="danger" title="Error">
          {error}
        </Alert>
      ) : null}

      {branches.length > 1 ? (
        <Select
          label="Sucursal"
          value={branchId ?? ""}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Section title="Listos / sin asignar" orders={grouped.ready} currency={currency} onAction={onAction} />
      <Section title="Asignados" orders={grouped.assigned} currency={currency} onAction={onAction} />
      <Section title="En camino" orders={grouped.en_route} currency={currency} onAction={onAction} />
      <Section title="En cocina" orders={grouped.other} currency={currency} onAction={onAction} />

      {!orders.length ? (
        <p className="py-12 text-center text-sm text-[#8fa08c]">
          No hay pedidos de delivery activos.
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  orders,
  currency,
  onAction,
}: {
  title: string;
  orders: Order[];
  currency: string;
  onAction: (o: Order) => void;
}) {
  if (!orders.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8fa08c]">
        {title}
      </h2>
      <ul className="space-y-2">
        {orders.map((o) => {
          const status = (o.deliveryStatus ||
            (o.status === "ready" ? "ready" : "preparing")) as DeliveryStatus;
          const label = NEXT_LABEL[status] || "Avanzar";
          return (
            <li
              key={o.id}
              className="rounded-xl border border-white/10 bg-[#152018] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[#e7efe4]">
                    #{o.id.slice(-6)} · {o.channel}
                  </p>
                  <p className="mt-0.5 text-sm text-[#a8b5a4]">
                    {o.deliveryAddress || o.notes || "Sin dirección"}
                  </p>
                  {o.deliveryPhone ? (
                    <p className="text-xs text-[#8fa08c]">{o.deliveryPhone}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[#8fa08c]">
                    {o.items
                      .slice(0, 4)
                      .map((i) => `${i.quantity}× ${i.name}`)
                      .join(", ")}
                    {o.items.length > 4 ? "…" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone="info">{deliveryStatusLabel(status)}</Badge>
                  <span className="text-sm font-semibold tabular-nums text-emerald-300">
                    {formatCurrency(o.total, currency)}
                  </span>
                  <Button size="sm" onClick={() => void onAction(o)}>
                    {label}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
