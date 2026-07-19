/**
 * Multi-tenant isolation contract.
 *
 * Data layout (scales to thousands of restaurants without code changes):
 *   restaurants/{restaurantId}/…   ← all tenant data
 *   users/{uid}                    ← global identity + restaurantIds[]
 *   restaurantSlugs/{slug}         ← public index only
 *   memberInvites/{id}             ← cross-tenant invite by email
 *
 * Rules:
 * - Never query across restaurants in app code
 * - restaurantId on every tenant document
 * - Authority = members/{uid} for the active restaurant (not users.role alone)
 * - Billing, settings, branches, members are per-restaurant documents
 */

export const TENANT_ROOT = "restaurants" as const;
export const BILLING_DOC_ID = "current" as const;
