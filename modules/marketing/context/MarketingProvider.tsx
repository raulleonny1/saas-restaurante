"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import { filterAudience } from "@/modules/marketing/domain/audience";
import { enrichCustomerLike } from "@/modules/marketing/domain/customer-enrich";
import {
  cancelCampaign,
  sendCampaign,
  softDeleteCampaign,
  subscribeCampaigns,
  upsertCampaign,
} from "@/modules/marketing/services/campaigns.service";
import {
  runAutomation,
  softDeleteAutomation,
  subscribeAutomations,
  upsertAutomation,
} from "@/modules/marketing/services/automations.service";
import {
  softDeleteCoupon,
  subscribeCoupons,
  upsertCoupon,
} from "@/modules/marketing/services/coupons.service";
import {
  refreshPromotionStatus,
  softDeletePromotion,
  subscribePromotions,
  upsertPromotion,
} from "@/modules/marketing/services/promotions.service";
import { subscribeCustomers } from "@/modules/customers/services/customers.service";
import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import type { Customer, CustomerSegmentId } from "@/types/customers";
import type {
  AudienceFilter,
  AutomationTrigger,
  Campaign,
  CampaignChannel,
  Coupon,
  MarketingAutomation,
  Promotion,
  PromotionStatus,
  PromotionType,
} from "@/types/promotions";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface MarketingContextValue {
  ready: boolean;
  error: string | null;
  customers: Customer[];
  campaigns: Campaign[];
  coupons: Coupon[];
  promotions: Promotion[];
  automations: MarketingAutomation[];
  segmentCounts: Record<CustomerSegmentId, number>;
  previewAudience: (channel: CampaignChannel, filter?: AudienceFilter) => number;
  saveCampaign: (input: {
    campaign?: Campaign | null;
    name: string;
    channel: CampaignChannel;
    subject?: string;
    body: string;
    audienceFilter?: AudienceFilter;
    promotionId?: string;
    couponId?: string;
    scheduledAt?: string;
    status?: Campaign["status"];
  }) => Promise<Campaign>;
  launchCampaign: (campaign: Campaign) => Promise<Campaign>;
  cancelCamp: (id: string) => Promise<void>;
  removeCampaign: (id: string) => Promise<void>;
  saveCoupon: (input: {
    coupon?: Coupon | null;
    code?: string;
    discountPercent?: number;
    discountAmount?: number;
    active?: boolean;
    startsAt?: string;
    expiresAt?: string;
    usageLimit?: number;
    promotionId?: string;
    targetSegments?: CustomerSegmentId[];
  }) => Promise<Coupon>;
  removeCoupon: (id: string) => Promise<void>;
  savePromotion: (input: {
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
  }) => Promise<Promotion>;
  removePromotion: (id: string) => Promise<void>;
  saveAutomation: (input: {
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
  }) => Promise<MarketingAutomation>;
  removeAutomation: (id: string) => Promise<void>;
  triggerAutomation: (automation: MarketingAutomation) => Promise<number>;
}

const MarketingContext = createContext<MarketingContextValue | null>(null);

export function useMarketing() {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error("useMarketing requires provider");
  return ctx;
}

export function MarketingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [automations, setAutomations] = useState<MarketingAutomation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!restaurantId || !isFirebaseConfigured()) {
      setReady(true);
      setError(
        !isFirebaseConfigured()
          ? "Firebase no está configurado"
          : "Selecciona un restaurante",
      );
      return;
    }
    setError(null);
    setReady(false);

    const u1 = subscribeCustomers(
      restaurantId,
      (rows) => {
        setCustomers(rows.map(enrichCustomerLike));
        setReady(true);
      },
      (e) => setError(e.message),
    );
    const u2 = subscribeCampaigns(
      restaurantId,
      setCampaigns,
      (e) => setError(e.message),
    );
    const u3 = subscribeCoupons(
      restaurantId,
      setCoupons,
      (e) => setError(e.message),
    );
    const u4 = subscribePromotions(
      restaurantId,
      (rows) => {
        setPromotions(
          rows.map((p) => ({ ...p, status: refreshPromotionStatus(p) })),
        );
      },
      (e) => setError(e.message),
    );
    const u5 = subscribeAutomations(
      restaurantId,
      setAutomations,
      (e) => setError(e.message),
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [restaurantId]);

  const segmentCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.keys(SEGMENT_LABELS).map((k) => [k, 0]),
    ) as Record<CustomerSegmentId, number>;
    for (const c of customers) {
      for (const s of c.segments ?? []) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return counts;
  }, [customers]);

  const previewAudience = useCallback(
    (channel: CampaignChannel, filter?: AudienceFilter) =>
      filterAudience(customers, filter, channel).length,
    [customers],
  );

  const requireRestaurant = () => {
    if (!restaurantId) throw new Error("Sin restaurante");
    if (!user?.uid) throw new Error("Sin sesión");
    return { restaurantId, uid: user.uid };
  };

  const value: MarketingContextValue = {
    ready,
    error,
    customers,
    campaigns,
    coupons,
    promotions,
    automations,
    segmentCounts,
    previewAudience,
    saveCampaign: async (input) => {
      const { restaurantId: rid, uid } = requireRestaurant();
      return upsertCampaign({ ...input, restaurantId: rid, createdBy: uid });
    },
    launchCampaign: async (campaign) => {
      const { restaurantId: rid } = requireRestaurant();
      return sendCampaign({ restaurantId: rid, campaign, customers });
    },
    cancelCamp: async (id) => {
      const { restaurantId: rid } = requireRestaurant();
      await cancelCampaign(rid, id);
    },
    removeCampaign: async (id) => {
      const { restaurantId: rid } = requireRestaurant();
      await softDeleteCampaign(rid, id);
    },
    saveCoupon: async (input) => {
      const { restaurantId: rid } = requireRestaurant();
      return upsertCoupon({ ...input, restaurantId: rid });
    },
    removeCoupon: async (id) => {
      const { restaurantId: rid } = requireRestaurant();
      await softDeleteCoupon(rid, id);
    },
    savePromotion: async (input) => {
      const { restaurantId: rid } = requireRestaurant();
      return upsertPromotion({ ...input, restaurantId: rid });
    },
    removePromotion: async (id) => {
      const { restaurantId: rid } = requireRestaurant();
      await softDeletePromotion(rid, id);
    },
    saveAutomation: async (input) => {
      const { restaurantId: rid, uid } = requireRestaurant();
      return upsertAutomation({ ...input, restaurantId: rid, createdBy: uid });
    },
    removeAutomation: async (id) => {
      const { restaurantId: rid } = requireRestaurant();
      await softDeleteAutomation(rid, id);
    },
    triggerAutomation: async (automation) => {
      const { restaurantId: rid, uid } = requireRestaurant();
      const res = await runAutomation({
        restaurantId: rid,
        automation,
        customers,
        createdBy: uid,
      });
      return res.targeted;
    },
  };

  return (
    <MarketingContext.Provider value={value}>{children}</MarketingContext.Provider>
  );
}
