import { buildMemberPermissionCache } from "@/lib/rbac/evaluate";
import { createId } from "@/lib/id";
import { slugify } from "@/modules/website/domain/slug";
import type { AppUser, UserRole } from "@/types/auth";
import type { TenantBilling } from "@/types/billing";
import { BILLING_PLANS } from "@/types/billing";
import type { RoleId } from "@/types/rbac";
import type { Branch, Member, Restaurant } from "@/types/restaurant";
import { DEFAULT_RESTAURANT_SETTINGS } from "@/types/restaurant";

function now(): string {
  return new Date().toISOString();
}

export function createUserDocument(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
): AppUser {
  const ts = now();
  return {
    uid,
    email,
    displayName,
    role,
    restaurantIds: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createRestaurantDocument(
  name: string,
  id = createId("rest"),
): Restaurant {
  const ts = now();
  const baseSlug = slugify(name) || "restaurante";
  return {
    id,
    name,
    timezone: "Europe/Madrid",
    currency: "EUR",
    status: "active",
    createdAt: ts,
    updatedAt: ts,
    settings: { ...DEFAULT_RESTAURANT_SETTINGS },
    slug: `${baseSlug}-${id.slice(-6).toLowerCase()}`,
    websitePublished: true,
  };
}

export function createBranchDocument(
  restaurantId: string,
  name: string,
  options?: Partial<Pick<Branch, "code" | "isDefault" | "timezone" | "currency">>,
): Branch {
  const ts = now();
  return {
    id: createId("branch"),
    restaurantId,
    name,
    code: options?.code ?? "MAIN",
    timezone: options?.timezone ?? "Europe/Madrid",
    currency: options?.currency ?? "EUR",
    status: "active",
    isDefault: options?.isDefault ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createMemberDocument(
  restaurantId: string,
  user: Pick<AppUser, "uid" | "email" | "displayName" | "role">,
  branchIds: string[] = [],
  options?: {
    permissionAllow?: Member["permissionAllow"];
    permissionDeny?: Member["permissionDeny"];
  },
): Member {
  const ts = now();
  const roleId = user.role as RoleId;
  const cache = buildMemberPermissionCache({
    roleId,
    permissionAllow: options?.permissionAllow,
    permissionDeny: options?.permissionDeny,
  });

  return {
    uid: user.uid,
    restaurantId,
    email: user.email,
    displayName: user.displayName,
    role: roleId,
    roleId,
    branchIds,
    permissionAllow: options?.permissionAllow ?? [],
    permissionDeny: options?.permissionDeny ?? [],
    permissionsCached: cache.permissionsCached,
    permissionsVersion: cache.permissionsVersion,
    active: true,
    joinedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** @deprecated use createMemberDocument(restaurantId, user, branchIds) */
export function createOwnerMember(
  user: Pick<AppUser, "uid" | "email" | "displayName" | "role">,
): Member {
  return createMemberDocument("", user, []);
}

/** Per-tenant SaaS billing singleton (isolated under the restaurant). */
export function createTenantBillingDocument(
  restaurantId: string,
  billingEmail?: string,
): TenantBilling {
  const ts = now();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  const plan = BILLING_PLANS.trial;
  return {
    id: "current",
    restaurantId,
    planId: "trial",
    status: "trialing",
    seatsIncluded: plan.seatsIncluded,
    branchesIncluded: plan.branchesIncluded,
    amountCents: plan.monthlyPriceCents,
    currency: "EUR",
    trialEndsAt: trialEnd.toISOString(),
    currentPeriodStart: ts,
    currentPeriodEnd: trialEnd.toISOString(),
    billingEmail,
    externalCustomerId: null,
    externalSubscriptionId: null,
    createdAt: ts,
    updatedAt: ts,
  };
}
