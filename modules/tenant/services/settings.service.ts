"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { Restaurant, RestaurantSettings } from "@/types/restaurant";
import type { CurrencyCode, Timezone } from "@/types/common";
import { doc, updateDoc } from "firebase/firestore";

export async function updateTenantSettings(input: {
  restaurantId: string;
  patch: {
    name?: string;
    legalName?: string;
    address?: string;
    phone?: string;
    email?: string;
    timezone?: Timezone;
    currency?: CurrencyCode;
    settings?: Partial<RestaurantSettings>;
  };
}): Promise<void> {
  const { settings, ...rest } = input.patch;
  const payload: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date().toISOString(),
  };
  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      payload[`settings.${key}`] = value;
    }
  }
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId),
    stripUndefined(payload),
  );
}

export type TenantSettingsPatch = Parameters<
  typeof updateTenantSettings
>[0]["patch"];

export type { Restaurant };
