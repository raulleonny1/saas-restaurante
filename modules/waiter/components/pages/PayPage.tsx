"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { formatCurrency } from "@/lib/format";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { openCashDrawer } from "@/modules/pos/domain/cash-drawer";
import { printOrderReceipt } from "@/modules/pos/domain/print";
import { balanceDue, roundMoney } from "@/modules/pos/domain/totals";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Order, Payment, PaymentMethod } from "@/types/orders";
import { Delete, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

/** Solo caja imprime tickets / abre cajón. El mesero solo cobra. */
function useIsCashierFloor() {
  const routes = useFloorRoutes();
  return routes.base === "/caja";
}

const METHODS: { id: PaymentMethod; label: string; accent: string }[] = [
  { id: "cash", label: "Efectivo", accent: "bg-emerald-700 border-emerald-500" },
  { id: "card", label: "Tarjeta", accent: "bg-sky-700 border-sky-500" },
  { id: "sumup", label: "SumUp", accent: "bg-violet-700 border-violet-500" },
  { id: "stripe", label: "Stripe", accent: "bg-indigo-700 border-indigo-500" },
  { id: "other", label: "Otro", accent: "bg-slate-600 border-slate-400" },
];

const CASH_CHIPS = [5, 10, 20, 50, 100];

function appendDigit(current: string, digit: string): string {
  if (digit === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (current === "0" && digit !== ".") return digit;
  // máx 2 decimales
  const [, dec] = current.split(".");
  if (dec && dec.length >= 2) return current;
  if (current.replace(".", "").length >= 8) return current;
  return `${current}${digit}`;
}

export function WaiterPayPage() {
  const { can } = useAuth();
  const { restaurantId, restaurant } = useRestaurant();
  const routes = useFloorRoutes();
  const isCashier = useIsCashierFloor();
  const canPrint = isCashier;
  const canKickDrawer = isCashier && can("payments.cash_drawer");
  const {
    activeOrder,
    balance,
    currency,
    pay,
    payments,
    selectedTableId,
    selectTable,
    restaurantName,
    openOrders,
  } = usePos();
  const chargeableOrders = useMemo(
    () =>
      openOrders
        .filter(
          (o) =>
            o.status !== "paid" &&
            o.status !== "cancelled" &&
            o.items.some((i) => i.status !== "cancelled") &&
            balanceDue(o) > 0.009,
        )
        .sort((a, b) => (a.tableName ?? "").localeCompare(b.tableName ?? "")),
    [openOrders],
  );
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
  const [printOnCharge, setPrintOnCharge] = useState(true);

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
      <div className="space-y-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl">
            Cobrar
          </h1>
          <p className="mt-1 text-sm text-[#a8b5a4]">
            {isCashier
              ? "Elige un ticket abierto. Si cobra el mesero en sala, el ticket sale aquí en la impresora de ventas (deja esta pantalla abierta)."
              : "Elige una mesa con ticket abierto para cobrar."}
          </p>
        </div>

        {chargeableOrders.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {chargeableOrders.map((o) => {
              const dueAmt = balanceDue(o);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (o.tableId) selectTable(o.tableId);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-950/30"
                  >
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-lg">
                        {o.tableName ?? "Mesa"}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#8fa08c]">
                        {o.items.filter((i) => i.status !== "cancelled").length}{" "}
                        líneas · pendiente
                      </span>
                    </span>
                    <span className="text-base font-semibold tabular-nums text-emerald-300">
                      {formatCurrency(dueAmt, currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-10 text-center">
            <Receipt className="mx-auto h-8 w-8 text-[#5a6b57]" />
            <p className="mt-3 text-sm font-medium text-[#c5d0c2]">
              No hay tickets por cobrar
            </p>
            <p className="mt-1 text-xs text-[#8fa08c]">
              Cuando haya pedidos abiertos con importe, aparecerán aquí.
            </p>
            <Link
              href={routes.home}
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium"
            >
              {isCashier ? "Ir a En vivo" : "Ir a Mesas"}
            </Link>
          </div>
        )}
      </div>
    );
  }

  const recentPays = [...payments]
    .filter((p) => p.status === "completed" || p.status === "refunded")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const onCharge = () => {
    void (async () => {
      try {
        setBusy(true);
        setMsg(null);
        const tender = method === "cash" ? tenderedNum : undefined;
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
        const ticketOrder: Order = {
          ...snapshot,
          status: "paid",
          paidAt: stamp,
          amountPaid: snapshot.total,
        };
        const ticketPayments = [...payments, payRow];
        setLastTicket({
          order: ticketOrder,
          payments: ticketPayments,
        });
        if (canKickDrawer && method === "cash") {
          void openCashDrawer(tpvPrinter).catch(() => {});
        }
        if (canPrint && printOnCharge) {
          try {
            printOrderReceipt(ticketOrder, ticketPayments, {
              restaurantName,
              paperWidthMm: tpvPrinter?.paperWidthMm ?? 80,
              printerSystemName: tpvPrinter?.systemName,
              printerLabel: tpvPrinter?.label ?? "Ventas · ticket cliente",
            });
          } catch {
            /* cobro OK aunque falle el diálogo de impresión */
          }
        }
        setMsg(
          isCashier
            ? printOnCharge
              ? "Cobrado · imprimiendo ticket de ventas…"
              : "Cobrado en caja · puedes imprimir el ticket abajo"
            : "Cobrado · la mesa queda sucia hasta limpiarla",
        );
        setTendered("");
        setTip("0");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Error al cobrar");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl">
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
        <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-emerald-300 lg:text-5xl">
          {formatCurrency(due, currency)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMethod(m.id);
              setLastChange(null);
              if (m.id === "cash") setTendered(String(due));
            }}
            className={`touch-manipulation rounded-2xl border-2 py-4 text-sm font-semibold transition-transform active:scale-[0.98] ${
              method === m.id
                ? `${m.accent} text-white`
                : "border-white/15 bg-white/[0.04] text-[#c5d0c2]"
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
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,320px)]">
          <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
            <div>
              <p className="text-xs text-[#8fa08c]">Cliente entrega</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-[#e7efe4] lg:text-4xl">
                {tendered === ""
                  ? "—"
                  : formatCurrency(Number(tendered) || 0, currency)}
              </p>
              <p className="mt-0.5 text-xs text-[#5a6b57]">{tendered || "0"}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTendered(String(totalDue))}
                className="touch-manipulation rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-4 py-3 text-sm font-medium"
              >
                Exacto
              </button>
              {CASH_CHIPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTendered(String(n))}
                  className="touch-manipulation rounded-xl border border-white/15 px-4 py-3 text-sm font-medium"
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

          <CashNumpad
            onDigit={(d) => setTendered((v) => appendDigit(v, d))}
            onClear={() => setTendered("")}
            onBackspace={() =>
              setTendered((v) => (v.length <= 1 ? "" : v.slice(0, -1)))
            }
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] py-6 text-center text-sm text-[#a8b5a4]">
          Se cobrará {formatCurrency(totalDue, currency)} con {method}.
        </p>
      )}

      <button
        type="button"
        disabled={busy || due <= 0 || !cashOk}
        onClick={onCharge}
        className="w-full touch-manipulation rounded-2xl bg-emerald-600 py-5 text-lg font-bold shadow-lg shadow-emerald-950/40 disabled:opacity-50"
      >
        {busy
          ? "Cobrando…"
          : method === "cash"
            ? `Cobrar y dar ${formatCurrency(change, currency)} de cambio`
            : `Cobrar ${formatCurrency(totalDue, currency)}`}
      </button>

      {canPrint ? (
        <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-[#a8b5a4]">
          <input
            type="checkbox"
            checked={printOnCharge}
            onChange={(e) => setPrintOnCharge(e.target.checked)}
            className="rounded border-white/30"
          />
          Imprimir ticket de ventas al cobrar
          {tpvPrinter?.systemName ? (
            <span className="text-[#8fa08c]">({tpvPrinter.systemName})</span>
          ) : null}
        </label>
      ) : null}

      {canKickDrawer &&
      tpvPrinter?.openDrawerOnCash &&
      tpvPrinter.systemName ? (
        <button
          type="button"
          className="w-full touch-manipulation rounded-xl border border-amber-500/40 bg-amber-950/30 py-3 text-sm font-medium text-amber-100"
          onClick={() => {
            void (async () => {
              const res = await openCashDrawer(tpvPrinter, { force: true });
              setMsg(
                res.ok
                  ? "Cajón abierto"
                  : res.message || "No se pudo abrir el cajón",
              );
            })();
          }}
        >
          Abrir cajón portamonedas
        </button>
      ) : null}

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
          {canPrint ? (
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
              className="w-full touch-manipulation rounded-xl bg-white/10 py-3 text-sm font-medium text-emerald-200"
            >
              Ver / imprimir ticket
            </button>
          ) : null}
          <Link
            href={routes.history}
            className="block text-center text-xs text-emerald-400"
          >
            Ir a Archivo · Caja del día
          </Link>
        </div>
      ) : (
        <p className="text-center text-xs text-[#5a6b57]">
          {canPrint
            ? "El ticket solo se muestra e imprime cuando el cobro está hecho."
            : "Tras cobrar, limpia la mesa desde la sala. La impresión es solo en caja."}
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

function CashNumpad({
  onDigit,
  onClear,
  onBackspace,
}: {
  onDigit: (d: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;
  return (
    <div className="rounded-2xl border border-white/15 bg-[#121a14] p-3">
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (k === "⌫") onBackspace();
              else onDigit(k);
            }}
            className="flex h-14 touch-manipulation items-center justify-center rounded-xl border border-white/15 bg-[#1a241c] text-xl font-semibold text-[#e7efe4] transition-transform active:scale-[0.96] active:bg-emerald-900/50 lg:h-16"
          >
            {k === "⌫" ? <Delete className="h-5 w-5" /> : k}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          className="col-span-3 flex h-12 touch-manipulation items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/30 text-sm font-semibold text-amber-100 active:scale-[0.98]"
        >
          C · Limpiar
        </button>
      </div>
    </div>
  );
}
