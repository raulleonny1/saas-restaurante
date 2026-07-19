"use client";

import { getDb } from "@/lib/firebase";
import { enrichCustomerLike } from "@/modules/marketing/domain/customer-enrich";
import { newId, nowIso } from "@/modules/marketing/domain/ids";
import {
  sendCampaign,
  upsertCampaign,
} from "@/modules/marketing/services/campaigns.service";
import type { Customer, CustomerSegmentId } from "@/types/customers";
import type {
  AutomationTrigger,
  CampaignChannel,
  MarketingAutomation,
} from "@/types/promotions";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

const TRIGGER_SEGMENT: Record<AutomationTrigger, CustomerSegmentId | null> = {
  birthday: "birthday",
  at_risk: "at_risk",
  dormant: "dormant",
  new_customer: "new",
  vip: "vip",
  winback_30: "at_risk",
};

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  birthday: "Cumpleaños",
  at_risk: "Clientes en riesgo",
  dormant: "Inactivos",
  new_customer: "Nuevos clientes",
  vip: "VIP",
  winback_30: "Win-back 30 días",
};

export function subscribeAutomations(
  restaurantId: string,
  onData: (rows: MarketingAutomation[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "marketingAutomations"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MarketingAutomation)
          .filter((a) => !a.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertAutomation(input: {
  restaurantId: string;
  createdBy: string;
  automation?: MarketingAutomation | null;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  channel: CampaignChannel;
  subject?: string;
  body: string;
  promotionId?: string;
  couponId?: string;
  cooldownDays?: number;
}): Promise<MarketingAutomation> {
  const stamp = nowIso();
  const id = input.automation?.id ?? newId("auto");
  const row: MarketingAutomation = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    enabled: input.enabled,
    trigger: input.trigger,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    promotionId: input.promotionId,
    couponId: input.couponId,
    cooldownDays: input.cooldownDays ?? 30,
    lastRunAt: input.automation?.lastRunAt,
    createdBy: input.automation?.createdBy ?? input.createdBy,
    createdAt: input.automation?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "marketingAutomations", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function softDeleteAutomation(
  restaurantId: string,
  automationId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      restaurantId,
      "marketingAutomations",
      automationId,
    ),
    { deletedAt: nowIso(), updatedAt: nowIso(), enabled: false },
  );
  await batch.commit();
}

async function recentlyContacted(
  restaurantId: string,
  customerId: string,
  automationId: string,
  cooldownDays: number,
): Promise<boolean> {
  const since = Date.now() - cooldownDays * 86_400_000;
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "campaignRecipients"),
    where("customerId", "==", customerId),
  );
  const snap = await getDocs(q);
  return snap.docs.some((d) => {
    const data = d.data();
    const sentAt = data.sentAt as string | undefined;
    if (!sentAt) return false;
    if (new Date(sentAt).getTime() < since) return false;
    // Cooldown applies to any recent outbound to this customer
    void automationId;
    return data.status === "sent" || data.status === "delivered";
  });
}

export async function runAutomation(input: {
  restaurantId: string;
  automation: MarketingAutomation;
  customers: Customer[];
  createdBy: string;
}): Promise<{ campaignId: string | null; targeted: number }> {
  const { restaurantId, automation, customers, createdBy } = input;
  if (!automation.enabled) return { campaignId: null, targeted: 0 };

  const segment = TRIGGER_SEGMENT[automation.trigger];
  const matched: Customer[] = [];

  for (const raw of customers) {
    const c = enrichCustomerLike(raw);
    const segs = c.segments ?? [];
    if (segment && !segs.includes(segment)) continue;
    if (automation.trigger === "winback_30") {
      // at_risk already covers 30–60 days
      if (!segs.includes("at_risk")) continue;
    }
    if (!c.marketingOptIn) continue;
    const cool = await recentlyContacted(
      restaurantId,
      c.id,
      automation.id,
      automation.cooldownDays,
    );
    if (cool) continue;
    matched.push(c);
  }

  if (!matched.length) {
    const batch = writeBatch(getDb());
    batch.update(
      doc(
        getDb(),
        "restaurants",
        restaurantId,
        "marketingAutomations",
        automation.id,
      ),
      { lastRunAt: nowIso(), updatedAt: nowIso() },
    );
    await batch.commit();
    return { campaignId: null, targeted: 0 };
  }

  const campaign = await upsertCampaign({
    restaurantId,
    createdBy,
    name: `Auto · ${automation.name} · ${new Date().toLocaleDateString("es")}`,
    channel: automation.channel,
    subject: automation.subject,
    body: automation.body,
    audienceFilter: {
      segments: segment ? [segment] : undefined,
      marketingOptInOnly: true,
    },
    promotionId: automation.promotionId,
    couponId: automation.couponId,
    status: "draft",
    automationId: automation.id,
  });

  // Restrict send to matched IDs via filter won't work for explicit list —
  // pass only matched customers to sendCampaign
  await sendCampaign({
    restaurantId,
    campaign,
    customers: matched,
  });

  const batch = writeBatch(getDb());
  batch.update(
    doc(
      getDb(),
      "restaurants",
      restaurantId,
      "marketingAutomations",
      automation.id,
    ),
    { lastRunAt: nowIso(), updatedAt: nowIso() },
  );
  await batch.commit();

  return { campaignId: campaign.id, targeted: matched.length };
}

export async function listEnabledAutomations(
  restaurantId: string,
): Promise<MarketingAutomation[]> {
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "marketingAutomations"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MarketingAutomation)
    .filter((a) => !a.deletedAt && a.enabled);
}
