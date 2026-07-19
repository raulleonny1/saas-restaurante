"use client";

import { getDb } from "@/lib/firebase";
import {
  listDueScheduledCampaigns,
  sendCampaign,
} from "@/modules/marketing/services/campaigns.service";
import {
  listEnabledAutomations,
  runAutomation,
} from "@/modules/marketing/services/automations.service";
import type { Customer } from "@/types/customers";
import { collection, getDocs } from "firebase/firestore";

export interface SchedulerResult {
  campaignsSent: number;
  automationsRun: number;
  automationTargets: number;
}

async function loadCustomers(restaurantId: string): Promise<Customer[]> {
  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "customers"),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Customer)
    .filter((c) => !c.deletedAt);
}

/**
 * Process due scheduled campaigns and enabled automations.
 * Safe to call periodically from the client while a manager is online.
 */
export async function processMarketingSchedule(input: {
  restaurantId: string;
  actorUid: string;
}): Promise<SchedulerResult> {
  const customers = await loadCustomers(input.restaurantId);
  let campaignsSent = 0;
  let automationsRun = 0;
  let automationTargets = 0;

  const due = await listDueScheduledCampaigns(input.restaurantId);
  for (const campaign of due) {
    await sendCampaign({
      restaurantId: input.restaurantId,
      campaign,
      customers,
    });
    campaignsSent += 1;
  }

  const autos = await listEnabledAutomations(input.restaurantId);
  for (const automation of autos) {
    // Throttle: skip if ran in last 6 hours
    if (automation.lastRunAt) {
      const last = new Date(automation.lastRunAt).getTime();
      if (Date.now() - last < 6 * 60 * 60 * 1000) continue;
    }
    const res = await runAutomation({
      restaurantId: input.restaurantId,
      automation,
      customers,
      createdBy: input.actorUid,
    });
    automationsRun += 1;
    automationTargets += res.targeted;
  }

  return { campaignsSent, automationsRun, automationTargets };
}
