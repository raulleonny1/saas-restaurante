"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { openCashDrawer } from "@/modules/pos/domain/cash-drawer";
import { printOrderReceipt } from "@/modules/pos/domain/print";
import { usePos } from "@/modules/pos/context/PosProvider";
import { getOrderById } from "@/modules/pos/services/orders.service";
import { subscribePaymentsForOrder } from "@/modules/pos/services/payments.service";
import {
  markReceiptPrintJobDone,
  markReceiptPrintJobFailed,
  subscribePendingReceiptPrintJobs,
  type ReceiptPrintJob,
} from "@/modules/pos/services/receipt-print-jobs.service";
import type { Payment } from "@/types/orders";
import { useEffect, useRef, useState } from "react";

const AUTO_PRINT_KEY = "smartserve_caja_auto_print_waiter";

function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(AUTO_PRINT_KEY);
  if (raw === null) return true;
  return raw !== "0";
}

function loadPaymentsForOrder(
  restaurantId: string,
  orderId: string,
): Promise<Payment[]> {
  return new Promise((resolve) => {
    const unsub = subscribePaymentsForOrder(restaurantId, orderId, (pays) => {
      unsub();
      resolve(pays);
    });
    window.setTimeout(() => {
      unsub();
      resolve([]);
    }, 4000);
  });
}

/**
 * Con /caja abierta: imprime tickets de cobros del mesero (cola receiptPrintJobs).
 */
export function CashierWaiterPrintListener() {
  const { restaurantId, restaurant } = useRestaurant();
  const { branchId, restaurantName } = usePos();
  const processingRef = useRef(new Set<string>());
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId || !branchId) return;

    return subscribePendingReceiptPrintJobs(restaurantId, branchId, (jobs) => {
      if (!isAutoPrintEnabled()) return;
      const pending = jobs.filter((j) => j.status === "pending");
      if (!pending.length) return;

      void (async () => {
        const tpv = getEffectivePrintSettings(
          restaurantId,
          restaurant?.settings,
        ).printers.tpv;

        for (const job of pending) {
          if (processingRef.current.has(job.id)) continue;
          processingRef.current.add(job.id);
          try {
            await printJob(job, {
              restaurantId,
              restaurantName,
              tpv,
            });
            const mesa = job.tableName?.trim() || "Mesa";
            setBanner(`Ticket sala · ${mesa} · imprimiendo en ventas…`);
            window.setTimeout(() => setBanner(null), 5000);
          } catch {
            /* marcado failed dentro de printJob */
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

async function printJob(
  job: ReceiptPrintJob,
  ctx: {
    restaurantId: string;
    restaurantName: string;
    tpv: ReturnType<typeof getEffectivePrintSettings>["printers"]["tpv"];
  },
) {
  try {
    const order = await getOrderById(ctx.restaurantId, job.orderId);
    if (!order) {
      await markReceiptPrintJobFailed({
        restaurantId: ctx.restaurantId,
        jobId: job.id,
        error: "Pedido no encontrado",
      });
      return;
    }
    const payments = await loadPaymentsForOrder(ctx.restaurantId, job.orderId);
    printOrderReceipt(order, payments, {
      restaurantName: ctx.restaurantName,
      paperWidthMm: ctx.tpv?.paperWidthMm ?? 80,
      printerSystemName: ctx.tpv?.systemName,
      printerLabel: ctx.tpv?.label ?? "Ventas · ticket cliente",
    });
    if (job.openDrawer) {
      void openCashDrawer(ctx.tpv).catch(() => {});
    }
    await markReceiptPrintJobDone({
      restaurantId: ctx.restaurantId,
      jobId: job.id,
    });
  } catch (e) {
    await markReceiptPrintJobFailed({
      restaurantId: ctx.restaurantId,
      jobId: job.id,
      error: e instanceof Error ? e.message : "Error al imprimir",
    });
  }
}
