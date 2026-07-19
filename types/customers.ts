import type { ISODateString, SoftDelete, Timestamps } from "./common";

export type CustomerTier = "standard" | "silver" | "gold" | "platinum";

export type CustomerSegmentId =
  | "vip"
  | "loyal"
  | "new"
  | "at_risk"
  | "dormant"
  | "birthday"
  | "high_value"
  | "allergy_watch";

export interface CustomerPreferences {
  /** Favorite product ids or free-text likes. */
  favorites?: string[];
  /** Seating, spice, milk, etc. */
  notes?: string[];
  preferredChannel?: "email" | "whatsapp" | "sms" | "push" | "none";
  preferredBranchId?: string;
  dietary?: string[];
}

export interface Customer extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  /** Shared across branches by default. */
  uid?: string;
  name: string;
  email?: string;
  phone?: string;
  /** Denormalized cache; source of truth can be loyaltyAccounts. */
  points: number;
  tier?: CustomerTier;
  /** ISO date `YYYY-MM-DD` or month-day. */
  birthday?: string;
  favorites: string[];
  tags?: string[];
  notes?: string;
  allergies?: string[];
  preferences?: CustomerPreferences;
  marketingOptIn: boolean;
  lastVisitAt?: ISODateString;
  lastBranchId?: string;
  totalSpent: number;
  visitCount: number;
  /** Average days between visits (computed). */
  avgDaysBetweenVisits?: number;
  /** 0–100 composite value score. */
  valueScore?: number;
  /** Cached segment labels. */
  segments?: CustomerSegmentId[];
}

export type CustomerHistoryType =
  | "visit"
  | "order"
  | "reservation"
  | "points_earn"
  | "points_redeem"
  | "promotion"
  | "note"
  | "profile_update";

/** Per-customer timeline (historial de cliente). */
export interface CustomerHistoryEntry extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string | null;
  customerId: string;
  type: CustomerHistoryType;
  title: string;
  description?: string;
  referenceType?: "order" | "reservation" | "promotion" | "payment";
  referenceId?: string;
  pointsDelta?: number;
  amount?: number;
  actorUid?: string;
}

export type LoyaltyTxType = "earn" | "redeem" | "adjust" | "expire";

export interface LoyaltyAccount extends Timestamps {
  id: string;
  restaurantId: string;
  customerId: string;
  points: number;
  tier: CustomerTier;
  lifetimePoints: number;
  expiresAt?: ISODateString;
}

export interface LoyaltyTransaction extends Timestamps {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  customerId: string;
  accountId: string;
  type: LoyaltyTxType;
  points: number;
  balanceAfter: number;
  referenceType?: "order" | "promotion" | "manual";
  referenceId?: string;
  note?: string;
  createdBy?: string;
}

export interface PersonalizedPromoDraft extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  customerId: string;
  name: string;
  message: string;
  discountPercent?: number;
  discountAmount?: number;
  segmentHint?: CustomerSegmentId;
  status: "draft" | "offered" | "redeemed" | "expired";
  promotionId?: string;
  expiresAt?: ISODateString;
  createdBy: string;
}
