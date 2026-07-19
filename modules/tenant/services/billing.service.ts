"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { createId } from "@/lib/id";
import { createTenantBillingDocument } from "@/models/schemas";
import type {
  BillingPlanId,
  TenantBilling,
  TenantInvoice,
} from "@/types/billing";
import { BILLING_PLANS } from "@/types/billing";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
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
  const plan = BILLING_PLANS[input.planId];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const patch: Partial<TenantBilling> = {
    planId: input.planId,
    status: input.planId === "trial" ? "trialing" : "active",
    seatsIncluded: plan.seatsIncluded,
    branchesIncluded: plan.branchesIncluded,
    amountCents: plan.monthlyPriceCents,
    currentPeriodStart: stamp,
    currentPeriodEnd: periodEnd.toISOString(),
    updatedAt: stamp,
  };

  const ref = doc(getDb(), "restaurants", input.restaurantId, "billing", "current");
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const created = createTenantBillingDocument(input.restaurantId);
    await setDoc(ref, stripUndefined({ ...created, ...patch }));
  } else {
    await updateDoc(ref, stripUndefined({ ...patch }));
  }

  // Issue a local invoice record (provider settlement can replace later)
  if (plan.monthlyPriceCents > 0) {
    const invId = createId("invc");
    const invoice: TenantInvoice = {
      id: invId,
      restaurantId: input.restaurantId,
      number: `SS-${input.restaurantId.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      planId: input.planId,
      amountCents: plan.monthlyPriceCents,
      currency: "EUR",
      status: "open",
      periodStart: stamp,
      periodEnd: periodEnd.toISOString(),
      issuedAt: stamp,
      description: `Plan ${plan.name}`,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await setDoc(
      doc(getDb(), "restaurants", input.restaurantId, "invoices", invId),
      stripUndefined({ ...invoice }),
    );
  }

  const next = await getDoc(ref);
  return { id: "current", ...next.data() } as TenantBilling;
}

export async function markInvoicePaid(input: {
  restaurantId: string;
  invoiceId: string;
}): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const stamp = new Date().toISOString();
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "invoices", input.invoiceId),
    { status: "paid", paidAt: stamp, updatedAt: stamp },
  );
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "billing", "current"),
    { status: "active", updatedAt: stamp },
  );
}
