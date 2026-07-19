"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { roundMoney } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import { subscribePaymentsForBranch } from "@/modules/pos/services/payments.service";
import type { Order, Payment } from "@/types/orders";
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

export function WaiterHistoryPage() {
  const { restaurantId } = useRestaurant();
  const {
    historyOrders,
    openOrders,
    currency,
    branchId,
    printPaidOrder,
  } = usePos();
  const [tab, setTab] = useState<"caja" | "cerrados" | "abiertos">("caja");
  const [branchPayments, setBranchPayments] = useState<Payment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !branchId) {
      setBranchPayments([]);
      return;
    }
    return subscribePaymentsForBranch(
      restaurantId,
      branchId,
      setBranchPayments,
    );
  }, [restaurantId, branchId]);

  const todayPayments = useMemo(
    () =>
      branchPayments.filter(
        (p) =>
          (p.status === "completed" || p.status === "refunded") &&
          isToday(p.paidAt ?? p.createdAt),
      ),
    [branchPayments],
  );

  const todayPaidOrders = useMemo(
    () =>
      historyOrders.filter(
        (o) =>
          o.status === "paid" && isToday(o.paidAt ?? o.updatedAt),
      ),
    [historyOrders],
  );

  const caja = useMemo(() => {
    let cashIn = 0;
    let cashChange = 0;
    let card = 0;
    let other = 0;
    let tips = 0;
    for (const p of todayPayments) {
      if (p.status === "refunded") {
        cashIn -= p.method === "cash" ? p.amount : 0;
        continue;
      }
      tips += p.tipAmount ?? 0;
      if (p.method === "cash") {
        cashIn += p.amount;
        cashChange += p.changeGiven ?? 0;
      } else if (p.method === "card" || p.method === "sumup" || p.method === "stripe") {
        card += p.amount;
      } else {
        other += p.amount;
      }
    }
    return {
      cashIn: roundMoney(cashIn),
      cashChange: roundMoney(cashChange),
      /** Efectivo neto en cajón ≈ cobrado (el cambio ya salió del billete) */
      cashNet: roundMoney(cashIn),
      card: roundMoney(card),
      other: roundMoney(other),
      tips: roundMoney(tips),
      tickets: todayPaidOrders.length,
      total: roundMoney(cashIn + card + other),
    };
  }, [todayPayments, todayPaidOrders.length]);

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of branchPayments) {
      const list = map.get(p.orderId) ?? [];
      list.push(p);
      map.set(p.orderId, list);
    }
    return map;
  }, [branchPayments]);

  const rows: Order[] =
    tab === "caja"
      ? todayPaidOrders
      : tab === "cerrados"
        ? historyOrders
        : openOrders;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Archivo · Caja
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Tickets cobrados y resumen para cuadrar con caja al final del turno.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
        {(
          [
            ["caja", "Caja hoy"],
            ["cerrados", "Archivo"],
            ["abiertos", "Abiertos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg py-2 text-xs sm:text-sm ${
              tab === id ? "bg-emerald-700" : "text-[#a8b5a4]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "caja" ? (
        <div className="space-y-2 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4">
          <p className="text-xs uppercase tracking-wide text-[#8fa08c]">
            Resumen del día · cuadrar con caja
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#8fa08c]">Tickets cobrados</p>
              <p className="text-xl font-semibold">{caja.tickets}</p>
            </div>
            <div>
              <p className="text-[#8fa08c]">Total cobrado</p>
              <p className="text-xl font-semibold text-emerald-300">
                {formatCurrency(caja.total, currency)}
              </p>
            </div>
            <div>
              <p className="text-[#8fa08c]">Efectivo</p>
              <p className="text-lg font-semibold text-cyan-200">
                {formatCurrency(caja.cashNet, currency)}
              </p>
            </div>
            <div>
              <p className="text-[#8fa08c]">Tarjeta / SumUp</p>
              <p className="text-lg font-semibold">
                {formatCurrency(caja.card, currency)}
              </p>
            </div>
            <div>
              <p className="text-[#8fa08c]">Cambios dados</p>
              <p className="text-sm">
                {formatCurrency(caja.cashChange, currency)}
              </p>
            </div>
            <div>
              <p className="text-[#8fa08c]">Propinas</p>
              <p className="text-sm">
                {formatCurrency(caja.tips, currency)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-[#5a6b57]">
            En caja debe haber el efectivo cobrado. Los cambios ya se descontaron
            del billete del cliente.
          </p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {rows.map((o) => {
          const pays = paymentsByOrder.get(o.id) ?? [];
          const open = expandedId === o.id;
          const canPrint =
            o.status === "paid" || Boolean(o.paidAt);
          return (
            <li
              key={o.id}
              className="rounded-xl border border-white/10 px-3 py-3"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(open ? null : o.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{o.tableName ?? "Sin mesa"}</p>
                  <span className="text-[11px] uppercase text-[#8fa08c]">
                    {o.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-300">
                  {formatCurrency(o.total, currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-[#5a6b57]">
                  {new Date(o.paidAt || o.updatedAt || o.createdAt).toLocaleString(
                    "es-ES",
                  )}{" "}
                  · {o.items.length} ítems
                  {pays.length
                    ? ` · ${pays.map((p) => p.method).join(", ")}`
                    : ""}
                </p>
              </button>

              {open ? (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <ul className="space-y-1 text-xs text-[#c5d0c2]">
                    {o.items
                      .filter((i) => i.status !== "cancelled")
                      .map((i) => (
                        <li key={i.id}>
                          {i.quantity}× {i.name}
                        </li>
                      ))}
                  </ul>
                  {pays.map((p) => (
                    <p key={p.id} className="text-xs text-[#8fa08c]">
                      {p.method}: {formatCurrency(p.amount, currency)}
                      {p.amountTendered != null
                        ? ` · entregó ${formatCurrency(p.amountTendered, currency)}`
                        : ""}
                      {p.changeGiven != null
                        ? ` · cambio ${formatCurrency(p.changeGiven, currency)}`
                        : ""}
                    </p>
                  ))}
                  {canPrint ? (
                    <button
                      type="button"
                      className="mt-1 w-full rounded-lg border border-white/20 py-2 text-xs text-emerald-300"
                      onClick={() => {
                        void printPaidOrder(o, pays)
                          .then(() => setMsg("Ticket enviado a imprimir"))
                          .catch((e) =>
                            setMsg(
                              e instanceof Error ? e.message : "Error al imprimir",
                            ),
                          );
                      }}
                    >
                      Ver / imprimir ticket
                    </button>
                  ) : (
                    <p className="text-[11px] text-amber-300/80">
                      El ticket solo se imprime cuando ya está cobrado.
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
        {!rows.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            {tab === "caja"
              ? "Aún no hay cobros hoy."
              : "Sin registros."}
          </li>
        ) : null}
      </ul>

      {msg ? (
        <p className="text-center text-xs text-emerald-300">{msg}</p>
      ) : null}
    </div>
  );
}
