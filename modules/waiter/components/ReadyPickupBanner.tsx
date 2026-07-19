"use client";

import { usePos } from "@/modules/pos/context/PosProvider";
import { useWaiterNotifications } from "@/modules/waiter/context/WaiterNotificationsProvider";
import {
  isWaiterAudioUnlocked,
  playWaiterPickupAlarm,
  unlockWaiterAudio,
} from "@/modules/waiter/domain/alertSound";
import { BellRing, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Mensaje flotante tipo chat: avisa a qué mesa llevar el pedido listo.
 */
export function ReadyPickupBanner() {
  const router = useRouter();
  const { selectTable, openOrders } = usePos();
  const { notifications, markRead, unlockAudio } = useWaiterNotifications();
  const [soundOn, setSoundOn] = useState(false);

  const pickups = notifications.filter((n) => {
    if (!n.id.startsWith("ready_")) return false;
    const order = openOrders.find((o) => o.id === n.referenceId);
    // Sin pedido activo o sin líneas listas → no mostrar
    if (!order) return false;
    if (order.status === "paid" || order.status === "cancelled") return false;
    return order.items.some((i) => i.status === "ready");
  });
  const top = pickups[0] ?? null;

  useEffect(() => {
    setSoundOn(isWaiterAudioUnlocked());
  }, [top?.id]);

  if (!top) return null;

  const order = openOrders.find((o) => o.id === top.referenceId)!;
  const rawTable = order.tableName?.trim() || "mesa";
  const tableLabel = /^mesa\b/i.test(rawTable) ? rawTable : `Mesa ${rawTable}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[80] flex justify-center px-3">
      <div
        className="pointer-events-auto w-full max-w-lg animate-fade-up overflow-hidden rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <BellRing className="h-6 w-6 animate-bounce" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
              Listo en cocina
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl leading-tight">
              Llevar a {tableLabel}
            </p>
            <p className="mt-1 text-sm text-white/90">{top.body}</p>
            {pickups.length > 1 ? (
              <p className="mt-1 text-xs text-white/75">
                +{pickups.length - 1} aviso
                {pickups.length === 2 ? "" : "s"} más
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Cerrar aviso"
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/15"
            onClick={() => void markRead(top.id)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-t border-white/20 bg-black/15 px-3 py-2.5">
          {!soundOn ? (
            <button
              type="button"
              className="flex-1 rounded-xl bg-white/20 px-3 py-2.5 text-sm font-semibold"
              onClick={() => {
                void (async () => {
                  await unlockWaiterAudio();
                  await unlockAudio();
                  await playWaiterPickupAlarm();
                  setSoundOn(true);
                })();
              }}
            >
              Activar sonido
            </button>
          ) : null}
          <button
            type="button"
            className="flex-[1.4] rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-emerald-900"
            onClick={() => {
              void (async () => {
                await unlockWaiterAudio();
                await playWaiterPickupAlarm();
                if (order?.tableId) {
                  selectTable(order.tableId);
                  router.push("/waiter/pedido");
                } else {
                  router.push("/waiter/notificaciones");
                }
              })();
            }}
          >
            Ir a la mesa
          </button>
          <button
            type="button"
            className="rounded-xl bg-white/15 px-3 py-2.5 text-sm font-medium"
            onClick={() => void markRead(top.id)}
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}
