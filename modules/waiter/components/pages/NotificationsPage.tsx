"use client";

import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { useWaiterNotifications } from "@/modules/waiter/context/WaiterNotificationsProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function WaiterNotificationsPage() {
  const router = useRouter();
  const routes = useFloorRoutes();
  const { notifications, markRead } = useWaiterNotifications();
  const { openOrders, selectTable } = usePos();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Notificaciones
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Platos listos y avisos del local.
        </p>
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border px-3 py-3 ${
              n.read
                ? "border-white/10"
                : "border-emerald-700/40 bg-emerald-950/25"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-1 text-xs text-[#a8b5a4]">{n.body}</p>
                <p className="mt-1 text-[11px] text-[#5a6b57]">
                  {new Date(n.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {!n.read ? (
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-emerald-400"
                  onClick={() => void markRead(n.id)}
                >
                  Ok
                </button>
              ) : null}
            </div>
            {n.referenceType === "order" && n.referenceId ? (
              <button
                type="button"
                className="mt-2 text-xs text-emerald-400"
                onClick={() => {
                  const order = openOrders.find((o) => o.id === n.referenceId);
                  if (order?.tableId) {
                    selectTable(order.tableId);
                    router.push(routes.order);
                  }
                }}
              >
                Ir al pedido
              </button>
            ) : n.href ? (
              <Link href={n.href} className="mt-2 inline-block text-xs text-emerald-400">
                Abrir
              </Link>
            ) : null}
          </li>
        ))}
        {!notifications.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            Sin avisos. Cuando cocina marque listo, aparecerán aquí.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
