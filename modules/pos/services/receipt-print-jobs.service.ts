"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { PaymentMethod } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";

export type ReceiptPrintJobStatus = "pending" | "done" | "failed";

/** Cola de tickets de cliente para imprimir en el PC de caja. */
export type ReceiptPrintJob = {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  paymentId: string;
  method: PaymentMethod;
  chargedFrom: "waiter";
  status: ReceiptPrintJobStatus;
  tableName?: string;
  openDrawer: boolean;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
  error?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function newReceiptPrintJobId() {
  return `rpj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildWaiterReceiptPrintJob(input: {
  restaurantId: string;
  branchId: string;
  orderId: string;
  paymentId: string;
  method: PaymentMethod;
  tableName?: string;
}): ReceiptPrintJob {
  const stamp = nowIso();
  return {
    id: newReceiptPrintJobId(),
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    orderId: input.orderId,
    paymentId: input.paymentId,
    method: input.method,
    chargedFrom: "waiter",
    status: "pending",
    tableName: input.tableName,
    openDrawer: input.method === "cash",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function subscribePendingReceiptPrintJobs(
  restaurantId: string,
  branchId: string,
  onData: (jobs: ReceiptPrintJob[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const col = collection(
    getDb(),
    "restaurants",
    restaurantId,
    "receiptPrintJobs",
  );
  const prefer = query(
    col,
    where("branchId", "==", branchId),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
  );

  let unsub: Unsubscribe = () => {};
  unsub = onSnapshot(
    prefer,
    (snap) => {
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReceiptPrintJob),
      );
    },
    (err) => {
      if (!/index|failed-precondition/i.test(err.message)) {
        onError?.(err);
        return;
      }
      unsub();
      unsub = onSnapshot(
        query(col, where("branchId", "==", branchId)),
        (snap) => {
          onData(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as ReceiptPrintJob)
              .filter((j) => j.status === "pending")
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          );
        },
        (e2) => onError?.(e2),
      );
    },
  );
  return () => unsub();
}

export async function markReceiptPrintJobDone(input: {
  restaurantId: string;
  jobId: string;
}): Promise<void> {
  const stamp = nowIso();
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "receiptPrintJobs",
      input.jobId,
    ),
    stripUndefined({
      status: "done" as ReceiptPrintJobStatus,
      printedAt: stamp,
      updatedAt: stamp,
    }),
  );
}

export async function markReceiptPrintJobFailed(input: {
  restaurantId: string;
  jobId: string;
  error: string;
}): Promise<void> {
  const stamp = nowIso();
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "receiptPrintJobs",
      input.jobId,
    ),
    {
      status: "failed" as ReceiptPrintJobStatus,
      error: input.error.slice(0, 200),
      updatedAt: stamp,
    },
  );
}
