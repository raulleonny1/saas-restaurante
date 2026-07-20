"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { ProductGrid } from "@/modules/pos/components/ProductGrid";
import { usePos } from "@/modules/pos/context/PosProvider";
import { orderForTable } from "@/modules/pos/domain/tableTone";
import { balanceDue, lineTotal } from "@/modules/pos/domain/totals";
import { orderItemStatusLabel } from "@/modules/waiter/domain/itemStatus";
import type { Order, OrderItem, Table } from "@/types/orders";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Send,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function isCounterTable(t: Table): boolean {
  const n = t.name.trim().toLowerCase();
  return (
    n === "mostrador" ||
    n === "caja" ||
    n === "venta caja" ||
    n === "mostrador caja"
  );
}

function isFreeForSale(t: Table, order: Order | null): boolean {
  if (t.status === "reserved") return false;
  if (t.status === "dirty") return true;
  if (t.status === "available") return true;
  // Ocupada solo si el pedido está vacío (fantasma) o no hay pedido
  if (!order) return true;
  const lines = order.items.filter((i) => i.status !== "cancelled");
  return lines.length === 0;
}

export function CashierSellPage() {
  const { restaurantId } = useRestaurant();
  const routes = useFloorRoutes();
  const {
    tables,
    openOrders,
    selectedTableId,
    selectTable,
    clearSelection,
    activeOrder,
    openSelectedTable,
    setItemQty,
    removeItem,
    sendKitchen,
    markItemsServed,
    createFloorTable,
    markTableClean,
    currency,
    balance,
    branchId,
  } = usePos();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"carta" | "ticket">("carta");
  /** Mesa recién creada (snapshot aún no llegó). */
  const [pinnedTable, setPinnedTable] = useState<Table | null>(null);

  const table =
    tables.find((t) => t.id === selectedTableId) ??
    (pinnedTable && pinnedTable.id === selectedTableId ? pinnedTable : null);
  const selling = Boolean(selectedTableId && table);

  const freeTables = useMemo(() => {
    return tables
      .filter((t) => {
        if (isCounterTable(t)) return false;
        const order = orderForTable(t, openOrders);
        return isFreeForSale(t, order);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [tables, openOrders]);

  const resumeOrders = useMemo(() => {
    return openOrders
      .filter(
        (o) =>
          o.status !== "paid" &&
          o.status !== "cancelled" &&
          o.items.some((i) => i.status !== "cancelled") &&
          balanceDue(o) > 0.009,
      )
      .sort((a, b) => (a.tableName ?? "").localeCompare(b.tableName ?? "", "es"));
  }, [openOrders]);

  const pendingSendCount =
    activeOrder?.items.filter((i) => i.status === "open").length ?? 0;
  const readyCount =
    activeOrder?.items.filter((i) => i.status === "ready").length ?? 0;

  const sortedItems = useMemo(() => {
    if (!activeOrder) return [];
    const rank = (s: string) =>
      s === "ready"
        ? 0
        : s === "open"
          ? 1
          : s === "delivered"
            ? 3
            : s === "cancelled"
              ? 4
              : 2;
    return [...activeOrder.items].sort(
      (a, b) => rank(a.status) - rank(b.status),
    );
  }, [activeOrder]);

  async function startAtTable(target: Table) {
    setBusy(true);
    setMsg(null);
    try {
      if (target.status === "dirty") {
        await markTableClean(target.id);
      }
      setPinnedTable(target);
      selectTable(target.id);
      setTab("carta");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo abrir la venta");
    } finally {
      setBusy(false);
    }
  }

  async function startCounter() {
    if (!restaurantId || !branchId) {
      setMsg("Sin sucursal. Espera a que cargue el plano.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let counter =
        tables.find(
          (t) => !t.deletedAt && t.branchId === branchId && isCounterTable(t),
        ) ?? null;
      if (!counter) {
        counter = await createFloorTable({
          name: "Mostrador",
          seats: 1,
          zone: "barra",
        });
      } else if (counter.status === "dirty") {
        await markTableClean(counter.id);
      }
      setPinnedTable(counter);
      selectTable(counter.id);
      setTab("carta");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo abrir el mostrador");
    } finally {
      setBusy(false);
    }
  }

  function resumeOrder(order: Order) {
    if (!order.tableId) return;
    const t = tables.find((x) => x.id === order.tableId);
    if (t) setPinnedTable(t);
    selectTable(order.tableId);
    setTab("ticket");
  }

  if (!selling) {
    return (
      <div className="space-y-6 pb-4">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/80 via-[#121a14] to-[#0e1410] px-5 py-7 sm:px-8 sm:py-9">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl"
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
            TPV · caja
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[#e7efe4] sm:text-4xl">
            Vender
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#a8b5a4]">
            Venta propia e independiente de los meseros. Carta completa: cocina,
            barra y todo el catálogo.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startCounter()}
            className="mt-6 flex w-full max-w-sm touch-manipulation items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-semibold text-[#04140c] shadow-lg shadow-emerald-950/50 transition active:scale-[0.98] disabled:opacity-50 sm:w-auto"
          >
            <Store className="h-5 w-5" />
            {busy ? "Abriendo…" : "Venta en mostrador"}
          </button>
        </div>

        {msg ? (
          <p className="text-center text-sm text-amber-300">{msg}</p>
        ) : null}

        {resumeOrders.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8fa08c]">
              Reanudar ticket
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {resumeOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => resumeOrder(o)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-emerald-500/35 hover:bg-emerald-950/25"
                  >
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-lg">
                        {o.tableName ?? "Ticket"}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#8fa08c]">
                        {
                          o.items.filter((i) => i.status !== "cancelled")
                            .length
                        }{" "}
                        líneas
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-300">
                      {formatCurrency(balanceDue(o), currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8fa08c]">
              Mesa libre
            </h2>
            <span className="text-[11px] text-[#5a6b57]">
              {freeTables.length} disponible
              {freeTables.length === 1 ? "" : "s"}
            </span>
          </div>
          {freeTables.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {freeTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void startAtTable(t)}
                  className="flex min-h-[88px] flex-col items-start justify-between rounded-2xl border border-white/12 bg-[#121a14] p-3.5 text-left transition hover:border-emerald-500/40 hover:bg-emerald-950/30 active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5 text-[#e7efe4]">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400/80" />
                    <span className="font-[family-name:var(--font-display)] text-lg leading-none">
                      {t.name}
                    </span>
                  </span>
                  <span className="text-[11px] text-[#8fa08c]">
                    {t.seats} asientos
                    {t.zone ? ` · ${t.zone}` : ""}
                    {t.status === "dirty" ? " · limpiar" : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center text-sm text-[#8fa08c]">
              No hay mesas libres. Usa el mostrador o espera a que se libere una.
            </p>
          )}
        </section>
      </div>
    );
  }

  const title = activeOrder?.tableName ?? table?.name ?? "Venta";

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            clearSelection();
            setPinnedTable(null);
            setMsg(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Cambiar punto de venta
        </button>
        <div className="flex gap-2">
          {activeOrder && (activeOrder.items.length > 0 || balance > 0) ? (
            <Link
              href={routes.pay}
              className="touch-manipulation rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold lg:hidden"
            >
              Cobrar
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
            {table && isCounterTable(table) ? "Mostrador" : "Mesa · caja"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight lg:text-3xl">
            {title}
          </h1>
          <p className="text-xs text-[#8fa08c] lg:text-sm">
            {activeOrder
              ? `Pendiente ${formatCurrency(balance, currency)}`
              : "Toca un producto para empezar el ticket"}
          </p>
        </div>
        {activeOrder ? (
          <p className="hidden font-[family-name:var(--font-display)] text-2xl text-emerald-300 lg:block">
            {formatCurrency(balance, currency)}
          </p>
        ) : null}
      </div>

      {msg ? (
        <p className="text-center text-sm text-emerald-300">{msg}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setTab("carta")}
          className={`touch-manipulation rounded-lg py-3 text-sm font-medium ${
            tab === "carta" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Carta
        </button>
        <button
          type="button"
          onClick={() => setTab("ticket")}
          className={`touch-manipulation rounded-lg py-3 text-sm font-medium ${
            tab === "ticket" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Ticket ({activeOrder?.items.length ?? 0})
        </button>
      </div>

      <div className="lg:hidden">
        {tab === "carta" ? (
          <ProductGrid tone="waiter" />
        ) : (
          <SellTicket
            items={sortedItems}
            readyCount={readyCount}
            pendingSendCount={pendingSendCount}
            busy={busy}
            currency={currency}
            balance={balance}
            payHref={routes.pay}
            canPay={Boolean(activeOrder && balanceDue(activeOrder) > 0.009)}
            onSetQty={(id, qty) => void setItemQty(id, qty)}
            onRemove={(id) => void removeItem(id)}
            onServeOne={(id) => {
              void (async () => {
                try {
                  setBusy(true);
                  await markItemsServed([id]);
                  setMsg("Entregado");
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            onServeAll={() => {
              void (async () => {
                try {
                  setBusy(true);
                  const ids = (activeOrder?.items ?? [])
                    .filter((i) => i.status === "ready")
                    .map((i) => i.id);
                  await markItemsServed(ids);
                  setMsg("Todo entregado");
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            onSend={() => {
              void (async () => {
                try {
                  setBusy(true);
                  if (!activeOrder) {
                    await openSelectedTable();
                  }
                  await sendKitchen();
                  setMsg(
                    pendingSendCount <= 1
                      ? "Enviado a cocina / barra"
                      : `${pendingSendCount} líneas enviadas`,
                  );
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
        )}
      </div>

      <div className="hidden h-[min(72dvh,760px)] gap-4 lg:grid lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121a14] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-2">
            <p className="text-sm font-semibold text-[#e7efe4]">Ticket</p>
            <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-[#a8b5a4]">
              {activeOrder?.items.length ?? 0} líneas
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SellTicket
              items={sortedItems}
              readyCount={readyCount}
              pendingSendCount={pendingSendCount}
              busy={busy}
              currency={currency}
              balance={balance}
              payHref={routes.pay}
              canPay={Boolean(
                activeOrder && balanceDue(activeOrder) > 0.009,
              )}
              onSetQty={(id, qty) => void setItemQty(id, qty)}
              onRemove={(id) => void removeItem(id)}
              onServeOne={(id) => {
                void (async () => {
                  try {
                    setBusy(true);
                    await markItemsServed([id]);
                    setMsg("Entregado");
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              onServeAll={() => {
                void (async () => {
                  try {
                    setBusy(true);
                    const ids = (activeOrder?.items ?? [])
                      .filter((i) => i.status === "ready")
                      .map((i) => i.id);
                    await markItemsServed(ids);
                    setMsg("Todo entregado");
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              onSend={() => {
                void (async () => {
                  try {
                    setBusy(true);
                    if (!activeOrder) await openSelectedTable();
                    await sendKitchen();
                    setMsg("Enviado a cocina / barra");
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </div>
        </aside>
        <section className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0f1612] p-3">
          <ProductGrid tone="waiter" />
        </section>
      </div>
    </div>
  );
}

function SellTicket({
  items,
  readyCount,
  pendingSendCount,
  busy,
  currency,
  balance,
  payHref,
  canPay,
  onSetQty,
  onRemove,
  onServeOne,
  onServeAll,
  onSend,
}: {
  items: OrderItem[];
  readyCount: number;
  pendingSendCount: number;
  busy: boolean;
  currency: string;
  balance: number;
  payHref: string;
  canPay: boolean;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onServeOne: (id: string) => void;
  onServeAll: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      {readyCount > 0 ? (
        <div className="rounded-xl border border-cyan-400/50 bg-cyan-950/40 px-3 py-2.5 text-sm text-cyan-100">
          {readyCount} listo{readyCount === 1 ? "" : "s"} · marca entregado
          cuando lo des al cliente.
        </div>
      ) : null}
      {pendingSendCount > 0 ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/35 px-3 py-2.5 text-sm text-amber-100">
          {pendingSendCount} sin enviar · solo irá lo nuevo a cocina/barra.
        </div>
      ) : null}

      <ul className="min-h-0 flex-1 space-y-2">
        {items.map((item) => {
          const ready = item.status === "ready";
          const served = item.status === "delivered";
          const inKitchen =
            item.status === "sent" || item.status === "preparing";
          return (
            <li
              key={item.id}
              className={`rounded-xl border px-3 py-3 ${
                ready
                  ? "border-cyan-400/60 bg-cyan-950/35"
                  : served
                    ? "border-white/10 bg-white/[0.02] opacity-70"
                    : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p
                    className={`mt-0.5 text-[11px] font-medium ${
                      ready
                        ? "text-cyan-300"
                        : served
                          ? "text-[#8fa08c]"
                          : inKitchen
                            ? "text-amber-300"
                            : "text-[#8fa08c]"
                    }`}
                  >
                    {orderItemStatusLabel(item.status)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(lineTotal(item), currency)}
                </p>
              </div>
              {ready ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onServeOne(item.id)}
                  className="mt-2 flex w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-cyan-700 py-2.5 text-xs font-medium"
                >
                  <Check className="h-3.5 w-3.5" />
                  Entregado al cliente
                </button>
              ) : null}
              {!served && !ready && item.status !== "cancelled" ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-white/20"
                    onClick={() => onSetQty(item.id, item.quantity - 1)}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="w-8 text-center text-base font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-white/20"
                    onClick={() => onSetQty(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="ml-auto flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-red-500/30 text-red-300"
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
        {!items.length ? (
          <li className="py-8 text-center text-sm text-[#8fa08c]">
            Añade productos desde la carta.
          </li>
        ) : null}
      </ul>

      {readyCount > 1 ? (
        <button
          type="button"
          disabled={busy}
          onClick={onServeAll}
          className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/40 py-3.5 text-sm font-medium text-cyan-100"
        >
          <Check className="h-4 w-4" />
          Todo entregado
        </button>
      ) : null}

      <button
        type="button"
        disabled={busy || pendingSendCount === 0}
        onClick={onSend}
        className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-sky-700 py-4 text-sm font-semibold disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {busy
          ? "Enviando…"
          : pendingSendCount === 0
            ? "Nada nuevo que enviar"
            : pendingSendCount === 1
              ? "Enviar 1 nuevo a cocina / barra"
              : `Enviar ${pendingSendCount} nuevos a cocina / barra`}
      </button>

      {canPay ? (
        <Link
          href={payHref}
          className="hidden touch-manipulation items-center justify-center rounded-xl bg-emerald-600 py-4 text-center text-sm font-semibold lg:flex"
        >
          Cobrar {formatCurrency(balance, currency)}
        </Link>
      ) : null}
    </div>
  );
}
