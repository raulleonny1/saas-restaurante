"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { printOrderReceipt } from "@/modules/pos/domain/print";
import { roundMoney } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Order, Payment, PaymentMethod } from "@/types/orders";
import Link from "next/link";
import { useMemo, useState } from "react";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "sumup", label: "SumUp" },
  { id: "stripe", label: "Stripe" },
  { id: "other", label: "Otro" },
];

const CASH_CHIPS = [5, 10, 20, 50, 100];

export function WaiterPayPage() {
  const { can } = useAuth();
  const { restaurantId, restaurant } = useRestaurant();
  const routes = useFloorRoutes();
  const {
    activeOrder,
    balance,
    currency,
    pay,
    payments,
    selectedTableId,
    restaurantName,
  } = usePos();
  const tpvPrinter = getEffectivePrintSettings(
    restaurantId,
    restaurant?.settings,
  ).printers.tpv;
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [tip, setTip] = useState("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<number | null>(null);
  const [lastTicket, setLastTicket] = useState<{
    order: Order;
    payments: Payment[];
  } | null>(null);

  const allowed = can("payments.charge");
  const due = balance;
  const tipNum = Number(tip) || 0;
  const totalDue = roundMoney(due + tipNum);

  const tenderedNum = tendered === "" ? NaN : Number(tendered);
  const change = useMemo(() => {
    if (method !== "cash") return 0;
    if (!Number.isFinite(tenderedNum)) return 0;
    return roundMoney(Math.max(0, tenderedNum - totalDue));
  }, [method, tenderedNum, totalDue]);

  const cashOk =
    method !== "cash" ||
    (Number.isFinite(tenderedNum) && tenderedNum + 0.001 >= totalDue);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-[#e7efe4]">
        <p className="font-medium">Sin permiso de cobro</p>
        <p className="mt-2 text-[#a8b5a4]">
          Tu cuenta aún no tiene cobro. Cierra sesión y vuelve a entrar, o pide
          al dueño que actualice el rol mesero.
        </p>
        <Link href={routes.order} className="mt-4 inline-block text-emerald-400">
          Volver al pedido
        </Link>
      </div>
    );
  }

  if (!selectedTableId || !activeOrder) {
    return (
      <div className="py-10 text-center text-sm text-[#a8b5a4]">
        Selecciona una mesa con ticket abierto.{" "}
        <Link href={routes.home} className="text-emerald-400">
          Ver pedidos en vivo
        </Link>
      </div>
    );
  }

  const recentPays = [...payments]
    .filter((p) => p.status === "completed" || p.status === "refunded")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Cobrar
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Mesa {activeOrder.tableName} · total{" "}
          {formatCurrency(activeOrder.total, currency)} · ya pagado{" "}
          {formatCurrency(activeOrder.amountPaid ?? 0, currency)}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-[#8fa08c]">
          Pendiente
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-emerald-300">
          {formatCurrency(due, currency)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMethod(m.id);
              setLastChange(null);
              if (m.id === "cash") setTendered(String(due));
            }}
            className={`rounded-xl border py-3 text-xs ${
              method === m.id
                ? "border-emerald-500 bg-emerald-900/40"
                : "border-white/15"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className="block text-xs text-[#8fa08c]">
        Propina extra
        <input
          type="number"
          inputMode="decimal"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3 text-base text-[#e7efe4]"
        />
      </label>

      {method === "cash" ? (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
          <label className="block text-xs text-[#8fa08c]">
            Cliente entrega
            <input
              type="text"
              inputMode="decimal"
              value={tendered}
              placeholder={String(totalDue)}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                if (v === "" || /^\d*\.?\d*$/.test(v)) setTendered(v);
              }}
              className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3 text-2xl font-semibold text-[#e7efe4]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTendered(String(totalDue))}
              className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-2 text-xs"
            >
              Exacto
            </button>
            {CASH_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTendered(String(n))}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs"
              >
                {formatCurrency(n, currency)}
              </button>
            ))}
          </div>

          <div
            className={`rounded-xl px-4 py-4 text-center ${
              cashOk
                ? "border border-cyan-400/40 bg-cyan-950/40"
                : "border border-amber-500/40 bg-amber-950/30"
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-[#a8b5a4]">
              Cambio a devolver
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-cyan-200">
              {formatCurrency(cashOk ? change : 0, currency)}
            </p>
            {!cashOk && Number.isFinite(tenderedNum) ? (
              <p className="mt-2 text-xs text-amber-300">
                Falta{" "}
                {formatCurrency(
                  roundMoney(totalDue - tenderedNum),
                  currency,
                )}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-[#a8b5a4]">
          Se cobrará {formatCurrency(totalDue, currency)} con {method}.
        </p>
      )}

      <button
        type="button"
        disabled={busy || due <= 0 || !cashOk}
        onClick={() => {
          void (async () => {
            try {
              setBusy(true);
              setMsg(null);
              const tender =
                method === "cash" ? tenderedNum : undefined;
              const snapshot = activeOrder;
              const changeDue =
                method === "cash" && tender != null
                  ? roundMoney(Math.max(0, tender - due - tipNum))
                  : 0;
              await pay(method, due, tipNum, undefined, tender, {
                chargedFrom: routes.base === "/caja" ? "caja" : "waiter",
              });
              if (method === "cash" && tender != null) {
                setLastChange(changeDue);
              } else {
                setLastChange(null);
              }
              const stamp = new Date().toISOString();
              const payRow: Payment = {
                id: `local_${stamp}`,
                restaurantId: snapshot.restaurantId,
                branchId: snapshot.branchId,
                orderId: snapshot.id,
                method,
                status: "completed",
                amount: due,
                currency: snapshot.currency,
                tipAmount: tipNum,
                processedBy: "local",
                paidAt: stamp,
                ...(tender != null ? { amountTendered: tender } : {}),
                ...(method === "cash" ? { changeGiven: changeDue } : {}),
                createdAt: stamp,
                updatedAt: stamp,
              };
              setLastTicket({
                order: {
                  ...snapshot,
                  status: "paid",
                  paidAt: stamp,
                  amountPaid: snapshot.total,
                },
                payments: [...payments, payRow],
              });
              setMsg(
                routes.base === "/caja"
                  ? "Cobrado en caja · queda en Archivo de mesero y cajero"
                  : "Cobrado · ticket listo · queda en Archivo/Caja",
              );
              setTendered("");
              setTip("0");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Error al cobrar");
            } finally {
              setBusy(false);
            }
          })();
        }}
        className="w-full rounded-xl bg-emerald-700 py-4 text-base font-semibold disabled:opacity-50"
      >
        {busy
          ? "Cobrando…"
          : method === "cash"
            ? `Cobrar y dar ${formatCurrency(change, currency)} de cambio`
            : `Cobrar ${formatCurrency(totalDue, currency)}`}
      </button>

      {lastChange != null && lastChange > 0 ? (
        <div className="rounded-2xl border border-cyan-400/50 bg-cyan-950/50 p-4 text-center">
          <p className="text-xs text-cyan-200/80">Entrega este cambio</p>
          <p className="font-[family-name:var(--font-display)] text-3xl text-cyan-100">
            {formatCurrency(lastChange, currency)}
          </p>
        </div>
      ) : null}

      {lastTicket ? (
        <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-200/80">
            Ticket cobrado
          </p>
          <p className="font-[family-name:var(--font-display)] text-xl">
            {lastTicket.order.tableName ?? "Mesa"} ·{" "}
            {formatCurrency(lastTicket.order.total, currency)}
          </p>
          <ul className="space-y-0.5 text-xs text-[#c5d0c2]">
            {lastTicket.order.items
              .filter((i) => i.status !== "cancelled")
              .map((i) => (
                <li key={i.id}>
                  {i.quantity}× {i.name}
                </li>
              ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              printOrderReceipt(lastTicket.order, lastTicket.payments, {
                restaurantName,
                paperWidthMm: tpvPrinter?.paperWidthMm ?? 80,
                printerSystemName: tpvPrinter?.systemName,
                printerLabel: tpvPrinter?.label ?? "TPV · ticket cliente",
              });
            }}
            className="w-full rounded-xl bg-white/10 py-3 text-sm font-medium text-emerald-200"
          >
            Ver / imprimir ticket
          </button>
          <Link
            href={routes.history}
            className="block text-center text-xs text-emerald-400"
          >
            Ir a Archivo · Caja del día
          </Link>
        </div>
      ) : (
        <p className="text-center text-xs text-[#5a6b57]">
          El ticket solo se muestra e imprime cuando el cobro está hecho.
        </p>
      )}

      {msg ? <p className="text-center text-sm text-emerald-300">{msg}</p> : null}

      {recentPays.length ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-[#8fa08c]">
            Pagos de esta mesa (tiempo real)
          </p>
          <ul className="space-y-1.5">
            {recentPays.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[#c5d0c2]"
              >
                <div className="flex justify-between gap-2">
                  <span className="capitalize">{p.method}</span>
                  <span className="font-medium text-[#e7efe4]">
                    {formatCurrency(p.amount, currency)}
                  </span>
                </div>
                {p.amountTendered != null ? (
                  <p className="mt-0.5 text-[#8fa08c]">
                    Entregó {formatCurrency(p.amountTendered, currency)}
                    {p.changeGiven != null
                      ? ` · cambio ${formatCurrency(p.changeGiven, currency)}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
