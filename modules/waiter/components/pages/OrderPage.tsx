"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import { ProductGrid } from "@/modules/pos/components/ProductGrid";
import { lineTotal } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import { ArrowLeft, Minus, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function WaiterOrderPage() {
  const { can } = useAuth();
  const {
    selectedTableId,
    tables,
    activeOrder,
    openSelectedTable,
    setItemQty,
    removeItem,
    sendKitchen,
    currency,
    balance,
  } = usePos();
  const [tab, setTab] = useState<"carta" | "ticket">("carta");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const table = tables.find((t) => t.id === selectedTableId);
  const canMove = can("pos.move_merge");

  if (!selectedTableId || !table) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-[#a8b5a4]">Selecciona una mesa o escanea QR.</p>
        <div className="flex justify-center gap-2">
          <Link
            href="/waiter"
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm"
          >
            Mesas
          </Link>
          <Link
            href="/waiter/qr"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            Escanear QR
          </Link>
        </div>
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <Link
          href="/waiter"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mesas
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
        href="/waiter"
        className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mesas
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
              href="/waiter/mover"
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs"
            >
              Mover
            </Link>
          ) : null}
          <Link
            href="/waiter/cobrar"
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
          <ul className="space-y-2">
            {activeOrder.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm">
                    {formatCurrency(lineTotal(item), currency)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20"
                    onClick={() => void setItemQty(item.id, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20"
                    onClick={() => void setItemQty(item.id, item.quantity + 1)}
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
              </li>
            ))}
            {!activeOrder.items.length ? (
              <li className="py-8 text-center text-sm text-[#8fa08c]">
                Añade platos desde la carta.
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            disabled={busy || !activeOrder.items.length}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  setMsg(null);
                  await sendKitchen();
                  setMsg("Enviado a cocina");
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
