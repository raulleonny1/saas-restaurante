"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { openCashDrawer } from "@/modules/pos/domain/cash-drawer";
import { printOrderReceipt } from "@/modules/pos/domain/print";
import { usePos } from "@/modules/pos/context/PosProvider";
import { getOrderById } from "@/modules/pos/services/orders.service";
import { subscribePaymentsForBranch } from "@/modules/pos/services/payments.service";
import type { Payment } from "@/types/orders";
import { useEffect, useRef, useState } from "react";

const AUTO_PRINT_KEY = "smartserve_caja_auto_print_waiter";

function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(AUTO_PRINT_KEY);
  if (raw === null) return true;
  return raw !== "0";
}

/**
 * Con /caja abierta en el PC de ventas: al cobrar el mesero en sala,
 * imprime el ticket aquí (impresora TPV) y opcionalmente abre el cajón.
 * El mesero no ve diálogo de impresión.
 */
export function CashierWaiterPrintListener() {
  const { restaurantId, restaurant } = useRestaurant();
  const { branchId, restaurantName } = usePos();
  const primedRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !branchId) return;

    primedRef.current = false;
    seenIdsRef.current = new Set();

    return subscribePaymentsForBranch(restaurantId, branchId, (payments) => {
      const completed = payments.filter(
        (p) =>
          p.status === "completed" &&
          p.chargedFrom === "waiter" &&
          Boolean(p.orderId),
      );

      if (!primedRef.current) {
        for (const p of completed) seenIdsRef.current.add(p.id);
        primedRef.current = true;
        return;
      }

      if (!isAutoPrintEnabled()) {
        for (const p of completed) seenIdsRef.current.add(p.id);
        return;
      }

      const fresh: Payment[] = [];
      for (const p of completed) {
        if (seenIdsRef.current.has(p.id)) continue;
        seenIdsRef.current.add(p.id);
        fresh.push(p);
      }
      if (!fresh.length) return;

      // Más reciente primero; imprimir en orden de llegada
      fresh.sort((a, b) =>
        (a.paidAt ?? a.createdAt).localeCompare(b.paidAt ?? b.createdAt),
      );

      void (async () => {
        const tpv = getEffectivePrintSettings(
          restaurantId,
          restaurant?.settings,
        ).printers.tpv;

        for (const payment of fresh) {
          try {
            const order = await getOrderById(restaurantId, payment.orderId);
            if (!order) continue;

            // Pagos parciales: reunir pagos del mismo pedido ya vistos + este
            const orderPays = payments.filter(
              (p) =>
                p.orderId === payment.orderId &&
                (p.status === "completed" || p.status === "refunded"),
            );

            printOrderReceipt(order, orderPays, {
              restaurantName,
              paperWidthMm: tpv?.paperWidthMm ?? 80,
              printerSystemName: tpv?.systemName,
              printerLabel: tpv?.label ?? "Ventas · ticket cliente",
            });

            if (payment.method === "cash") {
              void openCashDrawer(tpv).catch(() => {});
            }

            const mesa = order.tableName?.trim() || "Mesa";
            setBanner(`Ticket sala · ${mesa} · imprimiendo en ventas…`);
            window.setTimeout(() => setBanner(null), 5000);
          } catch {
            /* siguiente cobro */
          }
        }
      })();
    });
  }, [restaurantId, branchId, restaurant?.settings, restaurantName]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-50 flex justify-center px-4">
      <p className="rounded-full border border-emerald-400/40 bg-emerald-950/95 px-4 py-2 text-xs font-medium text-emerald-100 shadow-lg shadow-black/40">
        {banner}
      </p>
    </div>
  );
}
