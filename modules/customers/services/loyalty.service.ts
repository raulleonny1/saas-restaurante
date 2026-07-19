"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/customers/domain/ids";
import { deriveTier } from "@/modules/customers/domain/segments";
import type {
  CustomerTier,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyTxType,
} from "@/types/customers";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeLoyaltyAccount(
  restaurantId: string,
  customerId: string,
  onData: (account: LoyaltyAccount | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "restaurants", restaurantId, "loyaltyAccounts", customerId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() } as LoyaltyAccount);
    },
    (err) => onError?.(err),
  );
}

export function subscribeLoyaltyTx(
  restaurantId: string,
  customerId: string,
  onData: (rows: LoyaltyTransaction[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "loyaltyTransactions"),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as LoyaltyTransaction)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 100),
      );
    },
    (err) => onError?.(err),
  );
}

export async function adjustPoints(input: {
  restaurantId: string;
  customerId: string;
  points: number;
  type: LoyaltyTxType;
  createdBy: string;
  note?: string;
  branchId?: string | null;
  referenceType?: LoyaltyTransaction["referenceType"];
  referenceId?: string;
  /** Fixed id for idempotent earn from orders */
  transactionId?: string;
}): Promise<{ account: LoyaltyAccount; tx: LoyaltyTransaction }> {
  const accountId = input.customerId;
  const txId = input.transactionId ?? newId("ltx");
  const txRef = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "loyaltyTransactions",
    txId,
  );

  if (input.transactionId) {
    const existing = await getDoc(txRef);
    if (existing.exists()) {
      const accSnap = await getDoc(
        doc(
          getDb(),
          "restaurants",
          input.restaurantId,
          "loyaltyAccounts",
          accountId,
        ),
      );
      return {
        account: { id: accSnap.id, ...accSnap.data() } as LoyaltyAccount,
        tx: { id: existing.id, ...existing.data() } as LoyaltyTransaction,
      };
    }
  }

  const accRef = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "loyaltyAccounts",
    accountId,
  );
  const accSnap = await getDoc(accRef);
  const stamp = nowIso();
  const prev = accSnap.exists()
    ? ({ id: accSnap.id, ...accSnap.data() } as LoyaltyAccount)
    : null;

  const delta =
    input.type === "redeem" || input.type === "expire"
      ? -Math.abs(input.points)
      : input.type === "adjust"
        ? input.points
        : Math.abs(input.points);

  const points = Math.max(0, (prev?.points ?? 0) + delta);
  const lifetimePoints =
    delta > 0
      ? (prev?.lifetimePoints ?? 0) + delta
      : (prev?.lifetimePoints ?? points);
  const tier = deriveTier(points, points / 20) as CustomerTier;

  const account: LoyaltyAccount = {
    id: accountId,
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    points,
    tier,
    lifetimePoints,
    createdAt: prev?.createdAt ?? stamp,
    updatedAt: stamp,
  };

  const tx: LoyaltyTransaction = {
    id: txId,
    restaurantId: input.restaurantId,
    branchId: input.branchId ?? null,
    customerId: input.customerId,
    accountId,
    type: input.type,
    points: delta,
    balanceAfter: points,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(accRef, account);
  batch.set(txRef, tx);
  batch.update(
    doc(getDb(), "restaurants", input.restaurantId, "customers", input.customerId),
    {
      points,
      tier,
      updatedAt: stamp,
    },
  );

  // history
  const histId = newId("chist");
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "customerHistory", histId),
    {
      id: histId,
      restaurantId: input.restaurantId,
      branchId: input.branchId ?? null,
      customerId: input.customerId,
      type: delta >= 0 ? "points_earn" : "points_redeem",
      title: delta >= 0 ? `+${delta} puntos` : `${delta} puntos`,
      description: input.note,
      pointsDelta: delta,
      actorUid: input.createdBy,
      createdAt: stamp,
      updatedAt: stamp,
    },
  );

  await batch.commit();
  return { account, tx };
}
