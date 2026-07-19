import type { CurrencyCode, ISODateString, Timestamps } from "./common";

/** SaaS plans — same code serves unlimited tenants; plan is data, not branches. */
export type BillingPlanId = "trial" | "starter" | "growth" | "enterprise";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "paused";

export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export interface BillingPlanDefinition {
  id: BillingPlanId;
  name: string;
  description: string;
  monthlyPriceCents: number;
  seatsIncluded: number;
  branchesIncluded: number;
  features: string[];
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanDefinition> = {
  trial: {
    id: "trial",
    name: "Prueba",
    description: "14 días para evaluar SmartServe",
    monthlyPriceCents: 0,
    seatsIncluded: 5,
    branchesIncluded: 1,
    features: ["POS", "Cocina", "1 sucursal", "Soporte básico"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Un local con equipo reducido",
    monthlyPriceCents: 4900,
    seatsIncluded: 10,
    branchesIncluded: 1,
    features: ["POS", "Cocina", "CRM", "Web pública"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    description: "Multi-sucursal y marketing",
    monthlyPriceCents: 12900,
    seatsIncluded: 40,
    branchesIncluded: 5,
    features: ["Todo Starter", "Marketing", "Reportes", "Hasta 5 sucursales"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Cadenas y personalización",
    monthlyPriceCents: 29900,
    seatsIncluded: 200,
    branchesIncluded: 50,
    features: ["Todo Growth", "SLA", "Roles avanzados", "Sucursales ilimitadas*"],
  },
};

/** Singleton billing state per restaurant: restaurants/{id}/billing/current */
export interface TenantBilling extends Timestamps {
  id: "current";
  restaurantId: string;
  planId: BillingPlanId;
  status: BillingStatus;
  seatsIncluded: number;
  branchesIncluded: number;
  amountCents: number;
  currency: CurrencyCode;
  trialEndsAt?: ISODateString;
  currentPeriodStart?: ISODateString;
  currentPeriodEnd?: ISODateString;
  /** External provider ids (Stripe etc.) — opaque, never shared across tenants. */
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  billingEmail?: string;
  notes?: string;
}

export interface TenantInvoice extends Timestamps {
  id: string;
  restaurantId: string;
  number: string;
  planId: BillingPlanId;
  amountCents: number;
  currency: CurrencyCode;
  status: InvoiceStatus;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  issuedAt: ISODateString;
  paidAt?: ISODateString | null;
  description?: string;
}

/** Pending staff invite (root collection for email lookup). */
export interface MemberInvite extends Timestamps {
  id: string;
  restaurantId: string;
  restaurantName: string;
  email: string;
  roleId: import("./rbac").RoleId;
  branchIds: string[];
  invitedBy: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  acceptedAt?: ISODateString | null;
  acceptedUid?: string | null;
}
