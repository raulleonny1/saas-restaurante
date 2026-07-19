"use client";

import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { useWaiterNotifications } from "@/modules/waiter/context/WaiterNotificationsProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function WaiterNotificationsPage() {
  const router = useRouter();
  const routes = useFloorRoutes();
  const { notifications, markRead } = useWaiterNotifications();
  const { openOrders, selectTable } = usePos();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
          Sala
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Avisos
        </h1>
        <p className="mt-1 text-sm text-[#a8b5a4]">
          Platos listos y mensajes del local.
        </p>
      </div>

      <ul className="space-y-2.5">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border px-4 py-3.5 transition ${
              n.read
                ? "border-white/10 bg-white/[0.02]"
                : "border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 to-cyan-950/20 shadow-sm shadow-emerald-950/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {!n.read ? (
                  <span className="mb-1 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Nuevo
                  </span>
                ) : null}
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#a8b5a4]">
                  {n.body}
                </p>
                <p className="mt-1.5 text-[11px] text-[#5a6b57]">
                  {new Date(n.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {!n.read ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-300"
                  onClick={() => void markRead(n.id)}
                >
                  Ok
                </button>
              ) : null}
            </div>
            {n.referenceType === "order" && n.referenceId ? (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400"
                onClick={() => {
                  const order = openOrders.find((o) => o.id === n.referenceId);
                  if (order?.tableId) {
                    selectTable(order.tableId);
                    router.push(routes.order);
                  }
                }}
              >
                Ir al pedido <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : n.href ? (
              <Link
                href={n.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400"
              >
                Abrir <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </li>
        ))}
        {!notifications.length ? (
          <li className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-[#5a6b57]">
              <Bell className="h-5 w-5" />
            </span>
            <p className="max-w-[16rem] text-sm text-[#8fa08c]">
              Sin avisos. Cuando cocina marque listo, aparecerán aquí.
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
