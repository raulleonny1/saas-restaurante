"use client";

import { EventDetailPage } from "@/modules/website/components/public/PublicPages";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = use(params);
  return <EventDetailPage eventSlug={eventSlug} />;
}
