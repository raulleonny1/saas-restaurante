"use client";

import {
  ACTIVE_ORDER_STATUSES,
  money,
  orderStatusLabel,
} from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import type { OrderStatus } from "@/types/orders";

const STEPS: OrderStatus[] = ["open", "sent", "preparing", "ready", "delivered"];

function stepIndex(status: OrderStatus): number {
  if (status === "paid") return STEPS.length;
  if (status === "cancelled") return -1;
  const i = STEPS.indexOf(status);
  return i >= 0 ? i : 0;
}

export function CustomerTrackingPage() {
  const { orders, restaurant } = useCustomerApp();
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const recentDone = orders
    .filter((o) => !ACTIVE_ORDER_STATUSES.includes(o.status))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Seguimiento
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Estado en tiempo real de tus pedidos.
        </p>
      </div>

      {!active.length ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-[#8fa08c]">
          No hay pedidos en curso. Haz un pedido desde la pestaña Pedidos.
        </p>
      ) : (
        <ul className="space-y-4">
          {active.map((o) => {
            const idx = stepIndex(o.status);
            return (
              <li
                key={o.id}
                className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      Pedido ···{o.id.slice(-6)}
                    </p>
                    <p className="text-xs text-[#a8b5a4]">
                      {orderStatusLabel(o.status)} ·{" "}
                      {money(o.total, restaurant?.currency)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-800/60 px-2 py-0.5 text-[11px]">
                    En vivo
                  </span>
                </div>
                <ol className="mt-4 flex justify-between gap-1">
                  {STEPS.slice(0, 4).map((s, i) => (
                    <li
                      key={s}
                      className={`flex-1 text-center text-[10px] ${
                        i <= idx ? "text-emerald-400" : "text-[#5a6b57]"
                      }`}
                    >
                      <div
                        className={`mx-auto mb-1 h-2 w-2 rounded-full ${
                          i <= idx ? "bg-emerald-400" : "bg-[#3a4a38]"
                        }`}
                      />
                      {orderStatusLabel(s)}
                    </li>
                  ))}
                </ol>
                <ul className="mt-3 space-y-1 text-xs text-[#c5d0c2]">
                  {o.items.map((it) => (
                    <li key={it.id}>
                      {it.quantity}× {it.name}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {recentDone.length ? (
        <section>
          <h2 className="mb-2 text-sm text-[#8fa08c]">Recientes</h2>
          <ul className="space-y-2">
            {recentDone.map((o) => (
              <li
                key={o.id}
                className="flex justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                <span>···{o.id.slice(-6)}</span>
                <span className="text-[#a8b5a4]">
                  {orderStatusLabel(o.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
