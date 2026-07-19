"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/customers/domain/ids";
import { appendHistory } from "@/modules/customers/services/history.service";
import type {
  Customer,
  CustomerSegmentId,
  PersonalizedPromoDraft,
} from "@/types/customers";
import type { Promotion } from "@/types/promotions";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribePersonalizedPromos(
  restaurantId: string,
  customerId: string,
  onData: (rows: PersonalizedPromoDraft[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "personalizedPromos"),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PersonalizedPromoDraft)
          .filter((p) => !p.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export function buildPersonalizedOffer(customer: Customer): {
  name: string;
  message: string;
  discountPercent: number;
  segmentHint?: CustomerSegmentId;
} {
  const segments = customer.segments ?? [];
  if (segments.includes("birthday")) {
    return {
      name: "Regalo de cumpleaños",
      message: `¡Feliz cumpleaños, ${customer.name.split(" ")[0]}! 15% en tu próxima visita.`,
      discountPercent: 15,
      segmentHint: "birthday",
    };
  }
  if (segments.includes("at_risk") || segments.includes("dormant")) {
    return {
      name: "Te echamos de menos",
      message: `${customer.name.split(" ")[0]}, vuelve con un 20% de descuento esta semana.`,
      discountPercent: 20,
      segmentHint: segments.includes("dormant") ? "dormant" : "at_risk",
    };
  }
  if (segments.includes("vip") || segments.includes("high_value")) {
    return {
      name: "Detalle VIP",
      message: `Gracias por tu fidelidad, ${customer.name.split(" ")[0]}. 10% exclusivo + postre de cortesía.`,
      discountPercent: 10,
      segmentHint: "vip",
    };
  }
  if (segments.includes("new")) {
    return {
      name: "Bienvenida",
      message: `Bienvenido/a ${customer.name.split(" ")[0]}. 10% en tu segundo pedido.`,
      discountPercent: 10,
      segmentHint: "new",
    };
  }
  return {
    name: "Oferta personalizada",
    message: `${customer.name.split(" ")[0]}, disfruta de un 8% en tu próximo ticket.`,
    discountPercent: 8,
  };
}

export async function createPersonalizedPromo(input: {
  restaurantId: string;
  customer: Customer;
  createdBy: string;
  expiresInDays?: number;
}): Promise<{ draft: PersonalizedPromoDraft; promotion: Promotion }> {
  const offer = buildPersonalizedOffer(input.customer);
  const stamp = nowIso();
  const expires = new Date();
  expires.setDate(expires.getDate() + (input.expiresInDays ?? 14));
  const expiresAt = expires.toISOString();

  const promoId = newId("promo");
  const draftId = newId("ppromo");

  const promotion: Promotion = {
    id: promoId,
    restaurantId: input.restaurantId,
    branchIds: [],
    name: `${offer.name} · ${input.customer.name}`,
    type: "percent_off",
    status: "active",
    percentOff: offer.discountPercent,
    startsAt: stamp,
    endsAt: expiresAt,
    usageLimit: 1,
    usageCount: 0,
    stackable: false,
    targetCustomerIds: [input.customer.id],
    targetSegments: offer.segmentHint ? [offer.segmentHint] : [],
    personalizedMessage: offer.message,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const draft: PersonalizedPromoDraft = {
    id: draftId,
    restaurantId: input.restaurantId,
    customerId: input.customer.id,
    name: offer.name,
    message: offer.message,
    discountPercent: offer.discountPercent,
    segmentHint: offer.segmentHint,
    status: "offered",
    promotionId: promoId,
    expiresAt,
    createdBy: input.createdBy,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "promotions", promoId),
    promotion,
  );
  batch.set(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "personalizedPromos",
      draftId,
    ),
    draft,
  );
  await batch.commit();

  await appendHistory({
    restaurantId: input.restaurantId,
    customerId: input.customer.id,
    type: "promotion",
    title: offer.name,
    description: offer.message,
    referenceType: "promotion",
    referenceId: promoId,
    actorUid: input.createdBy,
  });

  return { draft, promotion };
}
