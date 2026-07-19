"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso, randomCouponCode } from "@/modules/marketing/domain/ids";
import type { Coupon } from "@/types/promotions";
import type { CustomerSegmentId } from "@/types/customers";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeCoupons(
  restaurantId: string,
  onData: (rows: Coupon[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "coupons"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Coupon)
          .filter((c) => !c.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertCoupon(input: {
  restaurantId: string;
  coupon?: Coupon | null;
  code?: string;
  discountPercent?: number;
  discountAmount?: number;
  active?: boolean;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  promotionId?: string;
  targetSegments?: CustomerSegmentId[];
}): Promise<Coupon> {
  const stamp = nowIso();
  const id = input.coupon?.id ?? newId("cpn");
  const code = (input.code ?? input.coupon?.code ?? randomCouponCode()).trim().toUpperCase();
  const row: Coupon = {
    id,
    restaurantId: input.restaurantId,
    branchIds: input.coupon?.branchIds ?? [],
    code,
    promotionId: input.promotionId ?? input.coupon?.promotionId,
    discountPercent: input.discountPercent,
    discountAmount: input.discountAmount,
    active: input.active ?? true,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    usageLimit: input.usageLimit,
    usageCount: input.coupon?.usageCount ?? 0,
    perCustomerLimit: input.perCustomerLimit ?? 1,
    targetSegments: input.targetSegments ?? input.coupon?.targetSegments,
    createdAt: input.coupon?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "coupons", id), row);
  await batch.commit();
  return row;
}

export async function softDeleteCoupon(
  restaurantId: string,
  couponId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "coupons", couponId), {
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    active: false,
  });
  await batch.commit();
}
