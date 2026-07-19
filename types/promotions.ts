import type { ISODateString, SoftDelete, Timestamps } from "./common";
import type { CustomerSegmentId, CustomerTier } from "./customers";

export type PromotionType =
  | "percent_off"
  | "fixed_off"
  | "bogo"
  | "happy_hour"
  | "points_multiplier";

export type PromotionStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "expired"
  | "disabled";

export type CampaignChannel = "email" | "whatsapp" | "push" | "sms" | "in_app";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed";

export type CampaignRecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "skipped";

export interface AudienceFilter {
  minPoints?: number;
  maxPoints?: number;
  tags?: string[];
  tier?: CustomerTier[];
  segments?: CustomerSegmentId[];
  /** Default true for outbound marketing. */
  marketingOptInOnly?: boolean;
  minValueScore?: number;
  minVisitCount?: number;
}

export interface Promotion extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  /** Empty = all branches. */
  branchIds: string[];
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  percentOff?: number;
  amountOff?: number;
  productIds?: string[];
  categoryIds?: string[];
  minOrderTotal?: number;
  startsAt: ISODateString;
  endsAt: ISODateString;
  usageLimit?: number;
  usageCount: number;
  stackable: boolean;
  targetCustomerIds?: string[];
  targetSegments?: string[];
  targetTags?: string[];
  personalizedMessage?: string;
}

export interface Coupon extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchIds: string[];
  code: string;
  promotionId?: string;
  discountPercent?: number;
  discountAmount?: number;
  active: boolean;
  startsAt?: ISODateString;
  expiresAt?: ISODateString;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  /** Audience hint for reporting / auto campaigns. */
  targetSegments?: CustomerSegmentId[];
}

export interface Campaign extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchIds: string[];
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  subject?: string;
  body: string;
  audienceFilter?: AudienceFilter;
  promotionId?: string;
  couponId?: string;
  scheduledAt?: ISODateString;
  sentAt?: ISODateString;
  createdBy: string;
  /** Set when created by an automation. */
  automationId?: string;
  stats?: {
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    skipped: number;
  };
}

export interface CampaignRecipient extends Timestamps {
  id: string;
  restaurantId: string;
  campaignId: string;
  customerId: string;
  customerName: string;
  channel: CampaignChannel;
  address: string;
  status: CampaignRecipientStatus;
  error?: string;
  providerMessageId?: string;
  sentAt?: ISODateString;
}

export type AutomationTrigger =
  | "birthday"
  | "at_risk"
  | "dormant"
  | "new_customer"
  | "vip"
  | "winback_30";

export interface MarketingAutomation extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  channel: CampaignChannel;
  subject?: string;
  body: string;
  promotionId?: string;
  couponId?: string;
  /** Cooldown days before re-targeting same customer. */
  cooldownDays: number;
  lastRunAt?: ISODateString;
  createdBy: string;
}
