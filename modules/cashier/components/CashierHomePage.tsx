"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { isDrinkStation } from "@/modules/kitchen/domain/stations";
import { usePos } from "@/modules/pos/context/PosProvider";
import { balanceDue, roundMoney } from "@/modules/pos/domain/totals";
import { subscribePaymentsForBranch } from "@/modules/pos/services/payments.service";
import { formatSlot } from "@/modules/reservations/domain/time";
import { subscribeReservations } from "@/modules/reservations/services/reservations.service";
import { orderItemStatusLabel } from "@/modules/waiter/domain/itemStatus";
import type { Order, OrderItem, OrderStatus } from "@/types/orders";
import type { Reservation } from "@/types/reservations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isToday(iso?: string) {
  if (!iso) return false;
  return iso >= startOfTodayIso();
}

function elapsedLabel(iso?: string) {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function itemStationLabel(item: OrderItem): "Barra" | "Cocina" | "Mesa" {
  if (item.status === "open" || !item.sentAt) return "Mesa";
  const station = item.kitchenStation;
  if (station && isDrinkStation(station)) return "Barra";
  return "Cocina";
}

function itemTone(status: OrderStatus): string {
  switch (status) {
    case "open":
      return "border-amber-500/30 bg-amber-950/30 text-amber-100";
    case "sent":
    case "preparing":
      return "border-sky-500/30 bg-sky-950/30 text-sky-100";
    case "ready":
      return "border-cyan-400/40 bg-cyan-950/40 text-cyan-100";
    case "delivered":
      return "border-emerald-500/25 bg-emerald-950/25 text-emerald-100";
    case "cancelled":
      return "border-white/10 bg-white/5 text-[#8fa08c] line-through";
    default:
      return "border-white/10 bg-white/5 text-[#c5d0c2]";
  }
}

function orderPhase(order: Order): {
  label: string;
  className: string;
} {
  const items = order.items.filter((i) => i.status !== "cancelled");
  if (items.length === 0) {
    return { label: "Abierta", className: "text-amber-300" };
  }
  if (items.some((i) => i.status === "ready")) {
    return { label: "Listo · retirar", className: "text-cyan-300" };
  }
  if (items.some((i) => i.status === "open" || !i.sentAt)) {
    return { label: "Mesero tomando", className: "text-amber-300" };
  }
  if (items.every((i) => i.status === "delivered")) {
    return { label: "Servido · por cobrar", className: "text-emerald-300" };
  }
  if (items.some((i) => i.status === "preparing" || i.status === "sent")) {
    const hasBar = items.some(
      (i) =>
        (i.status === "sent" || i.status === "preparing") &&
        i.kitchenStation &&
        isDrinkStation(i.kitchenStation),
    );
    const hasKitchen = items.some(
      (i) =>
        (i.status === "sent" || i.status === "preparing") &&
        (!i.kitchenStation || !isDrinkStation(i.kitchenStation)),
    );
    if (hasBar && hasKitchen) {
      return { label: "Cocina + barra", className: "text-sky-300" };
    }
    if (hasBar) return { label: "En barra", className: "text-sky-300" };
    return { label: "En cocina", className: "text-sky-300" };
  }
  return {
    label: orderItemStatusLabel(order.status),
    className: "text-[#a8b5a4]",
  };
}

function countByStation(items: OrderItem[]) {
  let mesa = 0;
  let cocina = 0;
  let barra = 0;
  let listo = 0;
  let servido = 0;
  for (const i of items) {
    if (i.status === "cancelled") continue;
    if (i.status === "ready") {
      listo += i.quantity;
      continue;
    }
    if (i.status === "delivered") {
      servido += i.quantity;
      continue;
    }
    const st = itemStationLabel(i);
    if (st === "Mesa") mesa += i.quantity;
    else if (st === "Barra") barra += i.quantity;
    else cocina += i.quantity;
  }
  return { mesa, cocina, barra, listo, servido };
}

type LiveFilter =
  | "all"
  | "mesero"
  | "cocina"
  | "barra"
  | "listo"
  | "cobrar";

const FILTER_LABEL: Record<LiveFilter, string> = {
  all: "Todas las mesas",
  mesero: "Mesero tomando",
  cocina: "En cocina",
  barra: "En barra",
  listo: "Listo · retirar",
  cobrar: "Por cobrar",
};

function matchesLiveFilter(
  filter: LiveFilter,
  counts: ReturnType<typeof countByStation>,
  due: number,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "mesero":
      return counts.mesa > 0;
    case "cocina":
      return counts.cocina > 0;
    case "barra":
      return counts.barra > 0;
    case "listo":
      return counts.listo > 0;
    case "cobrar":
      return due > 0.009;
  }
}

export function CashierHomePage() {
  const router = useRouter();
  const routes = useFloorRoutes();
  const { restaurantId } = useRestaurant();
  const {
    openOrders,
    currency,
    branchId,
    branches,
    setBranchId,
    selectTable,
  } = usePos();
  const [cashToday, setCashToday] = useState(0);
  const [cardToday, setCardToday] = useState(0);
  const [tipsToday, setTipsToday] = useState(0);
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  /** Re-tick every 30s so “hace X min” stays fresh */
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    return subscribeReservations(restaurantId, branchId, setReservations);
  }, [restaurantId, branchId]);

  const liveReservations = useMemo(() => {
    const dayStart = startOfTodayIso();
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const endIso = dayEnd.toISOString();
    return reservations
      .filter(
        (r) =>
          (r.status === "pending" ||
            r.status === "confirmed" ||
            r.status === "seated") &&
          r.startsAt >= dayStart &&
          r.startsAt <= endIso,
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [reservations]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    return subscribePaymentsForBranch(restaurantId, branchId, (payments) => {
      let cash = 0;
      let card = 0;
      let tips = 0;
      for (const p of payments) {
        if (!isToday(p.paidAt ?? p.createdAt)) continue;
        if (p.status === "refunded") {
          if (p.method === "cash") cash -= p.amount;
          continue;
        }
        if (p.status !== "completed") continue;
        tips += p.tipAmount ?? 0;
        if (p.method === "cash") cash += p.amount;
        else if (p.method === "card") card += p.amount;
      }
      setCashToday(roundMoney(cash));
      setCardToday(roundMoney(card));
      setTipsToday(roundMoney(tips));
    });
  }, [restaurantId, branchId]);

  const liveOrders = useMemo(() => {
    return [...openOrders]
      .filter((o) => o.status !== "paid" && o.status !== "cancelled")
      .map((o) => ({
        order: o,
        due: balanceDue(o),
        phase: orderPhase(o),
        counts: countByStation(o.items),
      }))
      .sort((a, b) => b.order.updatedAt.localeCompare(a.order.updatedAt));
  }, [openOrders]);

  const liveSummary = useMemo(() => {
    let mesero = 0;
    let cocina = 0;
    let barra = 0;
    let listo = 0;
    let porCobrar = 0;
    for (const row of liveOrders) {
      mesero += row.counts.mesa;
      cocina += row.counts.cocina;
      barra += row.counts.barra;
      listo += row.counts.listo;
      if (row.due > 0.009) porCobrar += 1;
    }
    return { mesero, cocina, barra, listo, porCobrar, mesas: liveOrders.length };
  }, [liveOrders]);

  const filteredOrders = useMemo(
    () =>
      liveOrders.filter((row) =>
        matchesLiveFilter(filter, row.counts, row.due),
      ),
    [liveOrders, filter],
  );

  function toggleFilter(next: LiveFilter) {
    setFilter((prev) => (prev === next ? "all" : next));
  }

  function openPay(order: Order) {
    if (order.tableId) selectTable(order.tableId);
    router.push(routes.pay);
  }

  function openOrder(order: Order) {
    if (order.tableId) selectTable(order.tableId);
    router.push(routes.order);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-2xl">
              Caja en vivo
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              En vivo
            </span>
          </div>
          <p className="mt-1 text-sm text-[#a8b5a4]">
            Pedidos en sala y cobros · déjala abierta para imprimir tickets del
            mesero
          </p>
          <Link
            href={routes.printers}
            className="mt-2 inline-block text-xs text-emerald-400 hover:underline"
          >
            Configurar impresora de ventas
          </Link>
        </div>
        {branches.length > 1 ? (
          <select
            value={branchId ?? ""}
            onChange={(e) => {
              if (e.target.value) setBranchId(e.target.value);
            }}
            className="rounded-lg border border-white/15 bg-[#121a14] px-2 py-1.5 text-xs"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <section className="rounded-2xl border border-violet-500/30 bg-violet-950/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">
              Reservas de hoy
            </p>
            <p className="mt-0.5 text-[11px] text-[#8fa08c]">
              Web y app · tiempo real
            </p>
          </div>
          <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-semibold text-violet-100">
            {liveReservations.length}
          </span>
        </div>
        {!liveReservations.length ? (
          <p className="mt-3 text-sm text-[#8fa08c]">
            Sin reservas pendientes para hoy.
          </p>
        ) : (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {liveReservations.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[#e7efe4]">
                      {r.customerName}
                      <span className="ml-2 text-xs font-normal text-[#8fa08c]">
                        · {r.partySize} pers.
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-violet-200/90">
                      {formatSlot(r.startsAt)}
                      {r.tableName ? ` · Mesa ${r.tableName}` : " · Sin mesa"}
                    </p>
                    <p className="mt-0.5 text-[11px] capitalize text-[#8fa08c]">
                      {r.status}
                      {r.source ? ` · ${r.source}` : ""}
                      {r.customerPhone ? ` · ${r.customerPhone}` : ""}
                    </p>
                  </div>
                  <Link
                    href="/reservations"
                    className="shrink-0 text-[11px] text-violet-300 hover:underline"
                  >
                    Gestionar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#8fa08c]">
            Efectivo
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(cashToday, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#8fa08c]">
            Tarjeta
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(cardToday, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-[#8fa08c]">
            Propinas
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(tipsToday, currency)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <button
          type="button"
          onClick={() => toggleFilter("all")}
          className={`rounded-full border px-2 py-1 ${
            filter === "all"
              ? "border-white/40 bg-white/10 text-white"
              : "border-white/15 text-[#c5d0c2]"
          }`}
        >
          {liveSummary.mesas} mesas
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("mesero")}
          className={`rounded-full border px-2 py-1 ${
            filter === "mesero"
              ? "border-amber-400/70 bg-amber-950/40 text-amber-100"
              : "border-amber-500/30 bg-amber-950/20 text-amber-200"
          }`}
        >
          Mesero {liveSummary.mesero}
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("cocina")}
          className={`rounded-full border px-2 py-1 ${
            filter === "cocina"
              ? "border-sky-400/70 bg-sky-950/45 text-sky-100"
              : "border-sky-500/30 bg-sky-950/20 text-sky-200"
          }`}
        >
          Cocina {liveSummary.cocina}
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("barra")}
          className={`rounded-full border px-2 py-1 ${
            filter === "barra"
              ? "border-violet-400/70 bg-violet-950/45 text-violet-100"
              : "border-violet-500/30 bg-violet-950/20 text-violet-200"
          }`}
        >
          Barra {liveSummary.barra}
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("listo")}
          className={`rounded-full border px-2 py-1 ${
            filter === "listo"
              ? "border-cyan-300/80 bg-cyan-950/45 text-cyan-100"
              : "border-cyan-400/35 bg-cyan-950/25 text-cyan-200"
          }`}
        >
          Listo {liveSummary.listo}
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("cobrar")}
          className={`rounded-full border px-2 py-1 ${
            filter === "cobrar"
              ? "border-emerald-400/70 bg-emerald-950/45 text-emerald-100"
              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          }`}
        >
          Por cobrar {liveSummary.porCobrar}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#c5d0c2]">
          {filter === "all"
            ? `Actividad en sala (${filteredOrders.length})`
            : `${FILTER_LABEL[filter]} (${filteredOrders.length})`}
        </h2>
        <div className="flex items-center gap-2">
          {filter !== "all" ? (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="text-xs text-[#8fa08c]"
            >
              Ver todas
            </button>
          ) : null}
          <Link href={routes.history} className="text-xs text-emerald-400">
            Caja del día
          </Link>
        </div>
      </div>

      {liveOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-[#8fa08c]">
          No hay pedidos abiertos. Cuando un mesero abra mesa, aparecerá aquí al
          instante.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-[#8fa08c]">
          Nada en «{FILTER_LABEL[filter]}» ahora.{" "}
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="text-emerald-400"
          >
            Ver todas
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredOrders.map(({ order, due, phase, counts }) => (
            <li
              key={order.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    Mesa {order.tableName || "—"}
                  </p>
                  <p className={`mt-0.5 text-xs font-medium ${phase.className}`}>
                    {phase.label}
                    <span className="font-normal text-[#6f7f6c]">
                      {" "}
                      · {elapsedLabel(order.updatedAt)}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(due, currency)}
                  </p>
                  <p className="text-[10px] text-[#8fa08c]">pendiente</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[#a8b5a4]">
                {counts.mesa > 0 ? <span>Mesa {counts.mesa}</span> : null}
                {counts.cocina > 0 ? <span>· Cocina {counts.cocina}</span> : null}
                {counts.barra > 0 ? <span>· Barra {counts.barra}</span> : null}
                {counts.listo > 0 ? (
                  <span className="text-cyan-300">· Listo {counts.listo}</span>
                ) : null}
                {counts.servido > 0 ? (
                  <span className="text-emerald-300">
                    · Servido {counts.servido}
                  </span>
                ) : null}
              </div>

              <ul className="mt-2.5 space-y-1.5">
                {order.items
                  .filter((i) => i.status !== "cancelled")
                  .map((item) => {
                    const station = itemStationLabel(item);
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${itemTone(item.status)}`}
                      >
                        <span className="min-w-0 truncate">
                          {item.quantity}× {item.name}
                          {item.variantName ? ` (${item.variantName})` : ""}
                        </span>
                        <span className="shrink-0 text-[10px] opacity-90">
                          {station === "Mesa"
                            ? "Mesero"
                            : station}
                          {" · "}
                          {orderItemStatusLabel(item.status)}
                        </span>
                      </li>
                    );
                  })}
              </ul>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openOrder(order)}
                  className="flex-1 rounded-xl border border-white/15 py-2 text-xs text-[#c5d0c2]"
                >
                  Ver pedido
                </button>
                <button
                  type="button"
                  onClick={() => openPay(order)}
                  disabled={due <= 0.009}
                  className="flex-[1.4] rounded-xl bg-emerald-700 py-2 text-xs font-medium disabled:opacity-40"
                >
                  Cobrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
