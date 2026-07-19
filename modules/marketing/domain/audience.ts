import {
  computeSegments,
  enrichCustomerLike,
} from "@/modules/marketing/domain/customer-enrich";
import type { Customer } from "@/types/customers";
import type { AudienceFilter, CampaignChannel } from "@/types/promotions";

/** Resolve contact address for a channel. */
export function channelAddress(
  customer: Customer,
  channel: CampaignChannel,
): string | null {
  switch (channel) {
    case "email":
      return customer.email?.trim() || null;
    case "sms":
    case "whatsapp":
      return customer.phone?.trim() || null;
    case "push":
    case "in_app":
      return customer.id;
    default:
      return null;
  }
}

export function filterAudience(
  customers: Customer[],
  filter: AudienceFilter | undefined,
  channel: CampaignChannel,
): Customer[] {
  const f = filter ?? {};
  const optInOnly = f.marketingOptInOnly !== false;

  return customers.filter((raw) => {
    const c = enrichCustomerLike(raw);
    if (optInOnly && !c.marketingOptIn) return false;
    if (!channelAddress(c, channel)) return false;

    if (typeof f.minPoints === "number" && (c.points ?? 0) < f.minPoints) {
      return false;
    }
    if (typeof f.maxPoints === "number" && (c.points ?? 0) > f.maxPoints) {
      return false;
    }
    if (typeof f.minValueScore === "number" && (c.valueScore ?? 0) < f.minValueScore) {
      return false;
    }
    if (
      typeof f.minVisitCount === "number" &&
      (c.visitCount ?? 0) < f.minVisitCount
    ) {
      return false;
    }
    if (f.tier?.length && !f.tier.includes(c.tier ?? "standard")) return false;
    if (f.tags?.length) {
      const tags = c.tags ?? [];
      if (!f.tags.some((t) => tags.includes(t))) return false;
    }
    if (f.segments?.length) {
      const segs = c.segments ?? computeSegments(c);
      if (!f.segments.some((s) => segs.includes(s))) return false;
    }
    return true;
  });
}
