"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { createTenantBillingDocument } from "@/models/schemas";
import type {
  BillingPlanId,
  TenantBilling,
  TenantInvoice,
} from "@/types/billing";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

export async function ensureTenantBilling(input: {
  restaurantId: string;
  billingEmail?: string;
}): Promise<TenantBilling> {
  const ref = doc(getDb(), "restaurants", input.restaurantId, "billing", "current");
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: "current", ...snap.data() } as TenantBilling;
  const row = createTenantBillingDocument(
    input.restaurantId,
    input.billingEmail,
  );
  await setDoc(ref, stripUndefined({ ...row }));
  return row;
}

export function subscribeBilling(
  restaurantId: string,
  onData: (billing: TenantBilling | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "restaurants", restaurantId, "billing", "current"),
    (snap) => {
      onData(
        snap.exists()
          ? ({ id: "current", ...snap.data() } as TenantBilling)
          : null,
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeInvoices(
  restaurantId: string,
  onData: (rows: TenantInvoice[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "invoices"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TenantInvoice)
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function changePlan(input: {
  restaurantId: string;
  planId: BillingPlanId;
}): Promise<TenantBilling> {
  const res = await fetch("/api/admin/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "changePlan",
      restaurantId: input.restaurantId,
      planId: input.planId,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
        "No se pudo cambiar el plan (configura FIREBASE_SERVICE_ACCOUNT_JSON en el servidor)",
    );
  }
  const ref = doc(getDb(), "restaurants", input.restaurantId, "billing", "current");
  const next = await getDoc(ref);
  if (!next.exists()) {
    throw new Error("Billing no encontrado tras el cambio de plan");
  }
  return { id: "current", ...next.data() } as TenantBilling;
}

export async function markInvoicePaid(input: {
  restaurantId: string;
  invoiceId: string;
}): Promise<void> {
  const res = await fetch("/api/admin/billing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "markInvoicePaid",
      restaurantId: input.restaurantId,
      invoiceId: input.invoiceId,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo marcar la factura como pagada");
  }
}
