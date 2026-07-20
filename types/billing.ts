import type { CurrencyCode, ISODateString, Timestamps } from "./common";

/** SaaS plans — same code serves unlimited tenants; plan is data, not branches. */
export type BillingPlanId = "trial" | "starter" | "business" | "enterprise";

/** Ids antiguos en Firestore → plan actual. */
export function normalizeBillingPlanId(
  id: string | null | undefined,
): BillingPlanId {
  if (id === "growth") return "business";
  if (id === "starter" || id === "business" || id === "enterprise" || id === "trial") {
    return id;
  }
  return "trial";
}

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
  /** Plan destacado en UI (⭐). */
  recommended?: boolean;
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanDefinition> = {
  trial: {
    id: "trial",
    name: "Gratis",
    description: "Prueba gratis 14 días",
    monthlyPriceCents: 0,
    seatsIncluded: 5,
    branchesIncluded: 1,
    features: ["POS", "Cocina", "1 sucursal", "Soporte básico"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Un local con equipo reducido",
    monthlyPriceCents: 1290,
    seatsIncluded: 10,
    branchesIncluded: 1,
    features: ["POS", "Cocina", "CRM", "Web pública"],
  },
  business: {
    id: "business",
    name: "Business",
    description: "Multi-sucursal y marketing",
    monthlyPriceCents: 2490,
    seatsIncluded: 40,
    branchesIncluded: 5,
    features: ["Todo Starter", "Marketing", "Reportes", "Hasta 5 sucursales"],
    recommended: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Cadenas y personalización",
    monthlyPriceCents: 4990,
    seatsIncluded: 200,
    branchesIncluded: 50,
    features: ["Todo Business", "SLA", "Roles avanzados", "Sucursales ilimitadas*"],
  },
};

/** Formato precio mensuales ES: 12,90 € */
export function formatPlanPrice(cents: number): string {
  if (cents <= 0) return "Gratis";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/** Estado en el índice platformTenants (vista superadmin). */
export type PlatformTenantStatus =
  | "active"
  | "pending_payment"
  | "trialing"
  | "cancelled";

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
  /** Plan que el dueño eligió al registrarse (puede estar pendiente de activar). */
  requestedPlanId?: BillingPlanId;
  /** Quién activó el plan de pago (superadmin). */
  activatedBy?: string;
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
