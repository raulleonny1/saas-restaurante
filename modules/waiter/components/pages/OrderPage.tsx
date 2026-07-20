"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { ProductGrid } from "@/modules/pos/components/ProductGrid";
import { usePos } from "@/modules/pos/context/PosProvider";
import { lineTotal } from "@/modules/pos/domain/totals";
import { orderItemStatusLabel } from "@/modules/waiter/domain/itemStatus";
import type { OrderItem } from "@/types/orders";
import { ArrowLeft, Check, Minus, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function WaiterOrderPage() {
  const { can } = useAuth();
  const routes = useFloorRoutes();
  const {
    selectedTableId,
    tables,
    activeOrder,
    setItemQty,
    removeItem,
    sendKitchen,
    markItemsServed,
    currency,
    balance,
  } = usePos();
  const [tab, setTab] = useState<"carta" | "ticket">("carta");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const readyCount =
    activeOrder?.items.filter((i) => i.status === "ready").length ?? 0;
  const sortedItems = useMemo(() => {
    if (!activeOrder) return [];
    const rank = (s: string) =>
      s === "ready" ? 0 : s === "delivered" ? 3 : s === "cancelled" ? 4 : 1;
    return [...activeOrder.items].sort(
      (a, b) => rank(a.status) - rank(b.status),
    );
  }, [activeOrder]);

  const table = tables.find((t) => t.id === selectedTableId);
  const canMove = can("pos.move_merge");

  if (!selectedTableId || !table) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-[#a8b5a4]">Selecciona una mesa o escanea QR.</p>
        <div className="flex justify-center gap-2">
          <Link
            href={routes.home}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm"
          >
            {routes.base === "/caja" ? "En vivo" : "Mesas"}
          </Link>
          {routes.base === "/waiter" ? (
            <Link
              href={routes.qr}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm"
            >
              Escanear QR
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const itemCount = activeOrder?.items.length ?? 0;
  const tableTitle = activeOrder?.tableName ?? table.name;

  const ticketPanel = (
    <TicketPanel
      items={sortedItems}
      readyCount={readyCount}
      busy={busy}
      msg={msg}
      currency={currency}
      balance={balance}
      onSetQty={(id, qty) => void setItemQty(id, qty)}
      onRemove={(id) => void removeItem(id)}
      onServeOne={(id) => {
        void (async () => {
          try {
            setBusy(true);
            await markItemsServed([id]);
            setMsg("Marcado como servido");
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
            setMsg("Todo marcado como servido");
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        })();
      }}
      onSendKitchen={() => {
        void (async () => {
          try {
            setBusy(true);
            setMsg(null);
            await sendKitchen();
            setMsg("Enviado a cocina / barra");
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        })();
      }}
      payHref={routes.pay}
      emptyHint="Añade platos desde la carta. La mesa se abre al primer producto."
      canPay={Boolean(activeOrder && itemCount > 0)}
    />
  );

  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={routes.home}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {routes.base === "/caja" ? "Volver" : "Volver a mesas"}
          <span className="font-normal text-[#8fa08c]">
            · {activeOrder ? "el pedido se guarda" : "sin pedido aún"}
          </span>
        </Link>
        <div className="flex gap-2">
          {canMove && activeOrder ? (
            <Link
              href={routes.move}
              className="touch-manipulation rounded-xl border border-white/15 px-3 py-2.5 text-sm"
            >
              Mover
            </Link>
          ) : null}
          {activeOrder && itemCount > 0 ? (
            <Link
              href={routes.pay}
              className="touch-manipulation rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold lg:hidden"
            >
              Cobrar
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          {routes.base === "/waiter" ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
              Pedido en sala
            </p>
          ) : null}
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight lg:text-3xl">
            Mesa {tableTitle}
          </h1>
          <p className="text-xs text-[#8fa08c] lg:text-sm">
            {activeOrder
              ? `${activeOrder.status} · pendiente ${formatCurrency(balance, currency)}`
              : "Toca un producto para empezar el pedido"}
          </p>
        </div>
        {activeOrder ? (
          <p className="hidden font-[family-name:var(--font-display)] text-2xl text-emerald-300 lg:block">
            {formatCurrency(balance, currency)}
          </p>
        ) : null}
      </div>

      {/* Móvil / tablet vertical: pestañas */}
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
          Ticket ({itemCount})
        </button>
      </div>

      <div className="lg:hidden">
        {tab === "carta" ? <ProductGrid tone="waiter" /> : ticketPanel}
      </div>

      {/* Monitor ancho: ticket | carta */}
      <div className="hidden h-[min(72dvh,760px)] gap-4 lg:grid lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121a14] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-2">
            <p className="text-sm font-semibold text-[#e7efe4]">Ticket</p>
            <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-[#a8b5a4]">
              {itemCount} líneas
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            {ticketPanel}
          </div>
        </aside>
        <section className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0f1612] p-3">
          <ProductGrid tone="waiter" />
        </section>
      </div>
    </div>
  );
}

function TicketPanel({
  items,
  readyCount,
  busy,
  msg,
  currency,
  balance,
  onSetQty,
  onRemove,
  onServeOne,
  onServeAll,
  onSendKitchen,
  payHref,
  emptyHint,
  canPay,
}: {
  items: OrderItem[];
  readyCount: number;
  busy: boolean;
  msg: string | null;
  currency: string;
  balance: number;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onServeOne: (id: string) => void;
  onServeAll: () => void;
  onSendKitchen: () => void;
  payHref: string;
  emptyHint: string;
  canPay: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      {readyCount > 0 ? (
        <div className="rounded-xl border border-cyan-400/50 bg-cyan-950/40 px-3 py-2.5 text-sm text-cyan-100">
          {readyCount} listo{readyCount === 1 ? "" : "s"} en cocina · retíralo
          y pulsa «Ya lo llevé».
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
                  Ya lo llevé a la mesa
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
            {emptyHint}
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
          Llevé todos los listos
        </button>
      ) : null}

      <button
        type="button"
        disabled={busy || !items.length}
        onClick={onSendKitchen}
        className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-sky-700 py-4 text-sm font-semibold disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {busy ? "Enviando…" : "Enviar a cocina"}
      </button>

      {canPay ? (
        <Link
          href={payHref}
          className="hidden touch-manipulation items-center justify-center rounded-xl bg-emerald-700 py-4 text-center text-sm font-semibold lg:flex"
        >
          Cobrar {formatCurrency(balance, currency)}
        </Link>
      ) : null}

      {msg ? (
        <p className="text-center text-xs text-emerald-300">{msg}</p>
      ) : null}
    </div>
  );
}
