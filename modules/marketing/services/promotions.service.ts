"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/marketing/domain/ids";
import type {
  Promotion,
  PromotionStatus,
  PromotionType,
} from "@/types/promotions";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribePromotions(
  restaurantId: string,
  onData: (rows: Promotion[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "promotions"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Promotion)
          .filter((p) => !p.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertPromotion(input: {
  restaurantId: string;
  promotion?: Promotion | null;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  percentOff?: number;
  amountOff?: number;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  stackable?: boolean;
  targetSegments?: string[];
  personalizedMessage?: string;
}): Promise<Promotion> {
  const stamp = nowIso();
  const id = input.promotion?.id ?? newId("promo");
  const row: Promotion = {
    id,
    restaurantId: input.restaurantId,
    branchIds: input.promotion?.branchIds ?? [],
    name: input.name.trim(),
    type: input.type,
    status: input.status,
    percentOff: input.percentOff,
    amountOff: input.amountOff,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: input.usageLimit,
    usageCount: input.promotion?.usageCount ?? 0,
    stackable: input.stackable ?? false,
    targetSegments: input.targetSegments ?? [],
    personalizedMessage: input.personalizedMessage,
    createdAt: input.promotion?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "promotions", id), row);
  await batch.commit();
  return row;
}

export async function softDeletePromotion(
  restaurantId: string,
  promotionId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "promotions", promotionId),
    { deletedAt: nowIso(), updatedAt: nowIso(), status: "disabled" },
  );
  await batch.commit();
}

export function refreshPromotionStatus(
  promo: Promotion,
  now = Date.now(),
): PromotionStatus {
  if (promo.status === "disabled" || promo.status === "draft") return promo.status;
  const start = new Date(promo.startsAt).getTime();
  const end = new Date(promo.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return promo.status;
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}
