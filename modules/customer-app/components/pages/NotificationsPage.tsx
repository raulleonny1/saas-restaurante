"use client";

import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import Link from "next/link";

export function CustomerNotificationsPage() {
  const { notifications, markRead, slug } = useCustomerApp();
  const base = `/c/${slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Notificaciones
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Avisos de pedidos, reservas y promociones.
        </p>
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border px-3 py-3 ${
              n.read
                ? "border-white/10 bg-transparent"
                : "border-emerald-700/40 bg-emerald-950/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-1 text-xs text-[#a8b5a4]">{n.body}</p>
                <p className="mt-1 text-[11px] text-[#5a6b57]">
                  {new Date(n.createdAt).toLocaleString("es-ES")} · {n.type}
                </p>
              </div>
              {!n.read ? (
                <button
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className="shrink-0 text-[11px] text-emerald-400"
                >
                  Marcar leída
                </button>
              ) : null}
            </div>
            {n.referenceType === "order" ? (
              <Link
                href={`${base}/seguimiento`}
                className="mt-2 inline-block text-xs text-emerald-400"
              >
                Ver seguimiento
              </Link>
            ) : null}
          </li>
        ))}
        {!notifications.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            Sin notificaciones por ahora.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
