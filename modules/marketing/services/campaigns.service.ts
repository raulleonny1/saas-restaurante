"use client";

import { getDb } from "@/lib/firebase";
import {
  channelAddress,
  filterAudience,
} from "@/modules/marketing/domain/audience";
import { newId, nowIso } from "@/modules/marketing/domain/ids";
import {
  dispatchMessage,
  personalizeBody,
} from "@/modules/marketing/services/dispatch.service";
import type { Customer } from "@/types/customers";
import type {
  AudienceFilter,
  Campaign,
  CampaignChannel,
  CampaignRecipient,
  CampaignStatus,
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

export function subscribeCampaigns(
  restaurantId: string,
  onData: (rows: Campaign[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "campaigns"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Campaign)
          .filter((c) => !c.deletedAt)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeCampaignRecipients(
  restaurantId: string,
  campaignId: string,
  onData: (rows: CampaignRecipient[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "campaignRecipients"),
    where("campaignId", "==", campaignId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CampaignRecipient)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertCampaign(input: {
  restaurantId: string;
  createdBy: string;
  campaign?: Campaign | null;
  name: string;
  channel: CampaignChannel;
  subject?: string;
  body: string;
  audienceFilter?: AudienceFilter;
  promotionId?: string;
  couponId?: string;
  scheduledAt?: string;
  status?: CampaignStatus;
  automationId?: string;
}): Promise<Campaign> {
  const stamp = nowIso();
  const id = input.campaign?.id ?? newId("cmp");
  const status: CampaignStatus =
    input.status ??
    (input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now()
      ? "scheduled"
      : input.campaign?.status ?? "draft");

  const row: Campaign = {
    id,
    restaurantId: input.restaurantId,
    branchIds: input.campaign?.branchIds ?? [],
    name: input.name.trim(),
    channel: input.channel,
    status,
    subject: input.subject,
    body: input.body,
    audienceFilter: input.audienceFilter,
    promotionId: input.promotionId,
    couponId: input.couponId,
    scheduledAt: input.scheduledAt,
    sentAt: input.campaign?.sentAt,
    createdBy: input.campaign?.createdBy ?? input.createdBy,
    automationId: input.automationId ?? input.campaign?.automationId,
    stats: input.campaign?.stats,
    createdAt: input.campaign?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const batch = writeBatch(getDb());
  batch.set(doc(getDb(), "restaurants", input.restaurantId, "campaigns", id), row);
  await batch.commit();
  return row;
}

export async function cancelCampaign(
  restaurantId: string,
  campaignId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "campaigns", campaignId), {
    status: "cancelled",
    updatedAt: nowIso(),
  });
  await batch.commit();
}

export async function softDeleteCampaign(
  restaurantId: string,
  campaignId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), "restaurants", restaurantId, "campaigns", campaignId), {
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    status: "cancelled",
  });
  await batch.commit();
}

export async function previewAudienceCount(
  customers: Customer[],
  channel: CampaignChannel,
  filter?: AudienceFilter,
): Promise<number> {
  return filterAudience(customers, filter, channel).length;
}

/**
 * Send (or simulate send) a campaign to filtered CRM audience.
 */
export async function sendCampaign(input: {
  restaurantId: string;
  campaign: Campaign;
  customers: Customer[];
}): Promise<Campaign> {
  const { restaurantId, campaign, customers } = input;
  const stamp = nowIso();
  const audience = filterAudience(
    customers,
    campaign.audienceFilter,
    campaign.channel,
  );

  const batchMark = writeBatch(getDb());
  batchMark.update(
    doc(getDb(), "restaurants", restaurantId, "campaigns", campaign.id),
    { status: "sending", updatedAt: stamp },
  );
  await batchMark.commit();

  const stats = {
    queued: audience.length,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    skipped: 0,
  };

  // Process in chunks to avoid huge batches
  const CHUNK = 40;
  for (let i = 0; i < audience.length; i += CHUNK) {
    const slice = audience.slice(i, i + CHUNK);
    const batch = writeBatch(getDb());

    for (const customer of slice) {
      const address = channelAddress(customer, campaign.channel);
      const recipientId = newId("rcpt");
      if (!address) {
        stats.skipped += 1;
        const skipped: CampaignRecipient = {
          id: recipientId,
          restaurantId,
          campaignId: campaign.id,
          customerId: customer.id,
          customerName: customer.name,
          channel: campaign.channel,
          address: "",
          status: "skipped",
          error: "Sin contacto para el canal",
          createdAt: stamp,
          updatedAt: stamp,
        };
        batch.set(
          doc(getDb(), "restaurants", restaurantId, "campaignRecipients", recipientId),
          skipped,
        );
        continue;
      }

      const first = customer.name.split(" ")[0] ?? customer.name;
      const body = personalizeBody(campaign.body, {
        name: first,
        fullName: customer.name,
        points: String(customer.points ?? 0),
        tier: customer.tier ?? "standard",
      });
      const subject = campaign.subject
        ? personalizeBody(campaign.subject, {
            name: first,
            fullName: customer.name,
          })
        : undefined;

      const result = await dispatchMessage({
        channel: campaign.channel,
        to: address,
        subject,
        body,
        customerName: customer.name,
        campaignId: campaign.id,
      });

      const recipient: CampaignRecipient = {
        id: recipientId,
        restaurantId,
        campaignId: campaign.id,
        customerId: customer.id,
        customerName: customer.name,
        channel: campaign.channel,
        address,
        status: result.ok ? "sent" : "failed",
        error: result.error,
        providerMessageId: result.providerMessageId,
        sentAt: result.ok ? stamp : undefined,
        createdAt: stamp,
        updatedAt: stamp,
      };
      batch.set(
        doc(getDb(), "restaurants", restaurantId, "campaignRecipients", recipientId),
        recipient,
      );

      if (result.ok) {
        stats.sent += 1;
        stats.delivered += 1;
        if (campaign.channel === "push" || campaign.channel === "in_app") {
          const nId = newId("ntf");
          batch.set(doc(getDb(), "restaurants", restaurantId, "notifications", nId), {
            id: nId,
            restaurantId,
            type: "marketing",
            title: subject || campaign.name,
            body,
            href: "/marketing",
            customerId: customer.id,
            campaignId: campaign.id,
            read: false,
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
      } else {
        stats.failed += 1;
      }
    }

    await batch.commit();
  }

  const finalStatus: CampaignStatus =
    stats.sent === 0 && stats.failed > 0 ? "failed" : "sent";
  const updated: Campaign = {
    ...campaign,
    status: finalStatus,
    sentAt: stamp,
    stats,
    updatedAt: stamp,
  };

  const finish = writeBatch(getDb());
  finish.update(
    doc(getDb(), "restaurants", restaurantId, "campaigns", campaign.id),
    {
      status: finalStatus,
      sentAt: stamp,
      stats,
      updatedAt: stamp,
    },
  );
  await finish.commit();
  return updated;
}

export async function listDueScheduledCampaigns(
  restaurantId: string,
  now = Date.now(),
): Promise<Campaign[]> {
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "campaigns"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Campaign)
    .filter((c) => {
      if (c.deletedAt) return false;
      if (c.status !== "scheduled") return false;
      if (!c.scheduledAt) return false;
      return new Date(c.scheduledAt).getTime() <= now;
    });
}
