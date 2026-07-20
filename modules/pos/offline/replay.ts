"use client";

/**
 * Reejecuta mutaciones de la cola offline contra servicios vivos.
 */

import type { PosQueuedMutation } from "@/modules/pos/offline/queue";
import { addItemToOrder, openTable, saveOrder, sendToKitchen } from "@/modules/pos/services/orders.service";
import { chargeOrder } from "@/modules/pos/services/payments.service";
import type { Order, OrderItem, PaymentMethod, Table } from "@/types/orders";
import type { Product, ProductCategory } from "@/types/catalog";

export async function replayPosMutation(
  mutation: PosQueuedMutation,
): Promise<void> {
  const p = mutation.payload;
  switch (mutation.type) {
    case "openTable": {
      const table = p.table as Table;
      const uid = String(p.uid || "");
      if (!table || !uid) throw new Error("openTable: payload incompleto");
      await openTable({
        restaurantId: mutation.restaurantId,
        branchId: mutation.branchId,
        table,
        uid,
        waiterName: p.waiterName as string | undefined,
        currency: (p.currency as "EUR") || "EUR",
        taxPercent: Number(p.taxPercent) || 10,
        tipDefaultPercent: Number(p.tipDefaultPercent) || 0,
      });
      return;
    }
    case "updateOrder": {
      const order = p.order as Order | undefined;
      const item = p.item as OrderItem | undefined;
      const uid = String(p.uid || "");
      if (order && item && uid) {
        await addItemToOrder(
          mutation.restaurantId,
          order,
          item,
          Number(p.taxPercent) || 10,
          uid,
        );
        return;
      }
      if (order && uid) {
        await saveOrder(
          mutation.restaurantId,
          order,
          Number(p.taxPercent) || 10,
          uid,
          String(p.eventType || "offline.replay"),
        );
        return;
      }
      throw new Error("updateOrder: payload incompleto");
    }
    case "payOrder": {
      const order = p.order as Order;
      const tables = (p.tables as Table[]) || [];
      const uid = String(p.uid || "");
      if (!order || !uid) throw new Error("payOrder: payload incompleto");
      await chargeOrder({
        restaurantId: mutation.restaurantId,
        order,
        tables,
        method: (p.method as PaymentMethod) || "cash",
        amount: Number(p.amount),
        tipAmount: Number(p.tipAmount) || 0,
        splitSeat: p.splitSeat as number | undefined,
        amountTendered: p.amountTendered as number | undefined,
        uid,
        processedByName: p.processedByName as string | undefined,
        chargedFrom: p.chargedFrom as "waiter" | "caja" | "pos" | undefined,
        taxPercent: Number(p.taxPercent) || 10,
        externalRef: p.externalRef as string | undefined,
        pspSimulated: Boolean(p.pspSimulated),
        cashSessionId: p.cashSessionId as string | undefined,
      });
      return;
    }
    case "sendKitchen": {
      const order = p.order as Order;
      const uid = String(p.uid || "");
      const products = (p.products as Product[]) || [];
      if (!order || !uid) throw new Error("sendKitchen: payload incompleto");
      await sendToKitchen(
        mutation.restaurantId,
        order,
        Number(p.taxPercent) || 10,
        uid,
        products,
        (p.categories as ProductCategory[]) || [],
        p.waiterName as string | undefined,
      );
      return;
    }
    case "moveTable":
    case "mergeTables":
    case "refundPayment":
    case "printMark":
      // Tipos reservados: si no hay payload suficiente, no borrar a ciegas
      throw new Error(
        `Replay de ${mutation.type} no implementado aún — reintenta en línea`,
      );
    default:
      throw new Error(`Tipo de mutación desconocido: ${mutation.type}`);
  }
}
