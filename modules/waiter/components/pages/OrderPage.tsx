"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { ProductGrid } from "@/modules/pos/components/ProductGrid";
import { usePos } from "@/modules/pos/context/PosProvider";
import { lineTotal } from "@/modules/pos/domain/totals";
import { orderItemStatusLabel } from "@/modules/waiter/domain/itemStatus";
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
    openSelectedTable,
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
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm"
          >
            {routes.base === "/caja" ? "En vivo" : "Mesas"}
          </Link>
          {routes.base === "/waiter" ? (
            <Link
              href={routes.qr}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm"
            >
              Escanear QR
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <Link
          href={routes.home}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {routes.base === "/caja" ? "Volver" : "Volver a mesas"}
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Mesa {table.name}
        </h1>
        <p className="text-sm text-[#a8b5a4]">Sin pedido abierto.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void (async () => {
              try {
                setBusy(true);
                await openSelectedTable();
                setTab("carta");
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Abriendo…" : "Abrir mesa / tomar pedido"}
        </button>
        {msg ? <p className="text-xs text-amber-300">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link
        href={routes.home}
        className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {routes.base === "/caja" ? "Volver" : "Volver a mesas"}
        <span className="font-normal text-[#8fa08c]">
          · el pedido se guarda
        </span>
      </Link>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            Mesa {activeOrder.tableName}
          </h1>
          <p className="text-xs text-[#8fa08c]">
            {activeOrder.status} · pendiente{" "}
            {formatCurrency(balance, currency)}
          </p>
        </div>
        <div className="flex gap-1.5">
          {canMove ? (
            <Link
              href={routes.move}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs"
            >
              Mover
            </Link>
          ) : null}
          <Link
            href={routes.pay}
            className="rounded-lg bg-emerald-800 px-2.5 py-1.5 text-xs"
          >
            Cobrar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab("carta")}
          className={`rounded-lg py-2 text-sm ${
            tab === "carta" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Carta
        </button>
        <button
          type="button"
          onClick={() => setTab("ticket")}
          className={`rounded-lg py-2 text-sm ${
            tab === "ticket" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Ticket ({activeOrder.items.length})
        </button>
      </div>

      {tab === "carta" ? (
        <div className="[&_button]:min-h-11">
          <ProductGrid tone="waiter" />
        </div>
      ) : (
        <div className="space-y-3">
          {readyCount > 0 ? (
            <div className="rounded-xl border border-cyan-400/50 bg-cyan-950/40 px-3 py-2.5 text-sm text-cyan-100">
              {readyCount} listo{readyCount === 1 ? "" : "s"} en cocina ·
              retíralo y pulsa «Ya lo llevé».
            </div>
          ) : null}
          <ul className="space-y-2">
            {sortedItems.map((item) => {
              const ready = item.status === "ready";
              const served = item.status === "delivered";
              const inKitchen =
                item.status === "sent" || item.status === "preparing";
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border px-3 py-2.5 ${
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
                    <p className="text-sm">
                      {formatCurrency(lineTotal(item), currency)}
                    </p>
                  </div>
                  {ready ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void (async () => {
                          try {
                            setBusy(true);
                            await markItemsServed([item.id]);
                            setMsg("Marcado como servido");
                          } catch (e) {
                            setMsg(e instanceof Error ? e.message : "Error");
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-700 py-2 text-xs font-medium"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Ya lo llevé a la mesa
                    </button>
                  ) : null}
                  {!served && !ready && item.status !== "cancelled" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20"
                        onClick={() =>
                          void setItemQty(item.id, item.quantity - 1)
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20"
                        onClick={() =>
                          void setItemQty(item.id, item.quantity + 1)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 text-red-300"
                        onClick={() => void removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {!activeOrder.items.length ? (
              <li className="py-8 text-center text-sm text-[#8fa08c]">
                Añade platos desde la carta.
              </li>
            ) : null}
          </ul>

          {readyCount > 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  try {
                    setBusy(true);
                    const ids = activeOrder.items
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-950/40 py-3 text-sm font-medium text-cyan-100"
            >
              <Check className="h-4 w-4" />
              Llevé todos los listos
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy || !activeOrder.items.length}
            onClick={() => {
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 text-sm font-medium disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {busy ? "Enviando…" : "Enviar a cocina"}
          </button>
          {msg ? <p className="text-center text-xs text-emerald-300">{msg}</p> : null}
        </div>
      )}
    </div>
  );
}
