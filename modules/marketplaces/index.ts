/**
 * Marketplaces (Fase 9) — Glovo / Uber Eats.
 * Solo stubs hasta partner + contratos. Delivery propio = Fase 5.
 */

export type MarketplaceProvider = "glovo" | "uber_eats";

export type MarketplaceConnectionStatus =
  | "not_configured"
  | "pending_partner"
  | "connected"
  | "error";

export interface MarketplaceCredentials {
  provider: MarketplaceProvider;
  clientId?: string;
  storeId?: string;
  /** Nunca exponer en cliente; solo env server. */
  hasServerSecret: boolean;
}

export interface MarketplaceOrderRef {
  provider: MarketplaceProvider;
  externalId: string;
  status: string;
  syncedAt: string;
}

export function getMarketplaceStatus(
  provider: MarketplaceProvider,
): MarketplaceConnectionStatus {
  const envKey =
    provider === "glovo"
      ? "GLOVO_PARTNER_KEY"
      : "UBER_EATS_CLIENT_SECRET";
  if (!process.env[envKey]) return "not_configured";
  return "pending_partner";
}

/**
 * Importación de pedido externo → Order channel delivery.
 * Sin partner: lanza error controlado.
 */
export async function importMarketplaceOrder(_input: {
  restaurantId: string;
  branchId: string;
  provider: MarketplaceProvider;
  payload: unknown;
}): Promise<never> {
  throw new Error(
    "Integración marketplace no activa. Usa delivery propio (/delivery) hasta tener partner Glovo/Uber.",
  );
}

/**
 * Empuja cambio de estado al marketplace (cuando haya API partner).
 */
export async function pushMarketplaceStatus(_input: {
  provider: MarketplaceProvider;
  externalId: string;
  status: string;
}): Promise<{ ok: false; reason: string }> {
  return {
    ok: false,
    reason: "Partner no configurado (Fase 9)",
  };
}

export const MARKETPLACE_PROVIDERS: {
  id: MarketplaceProvider;
  name: string;
  docsHint: string;
}[] = [
  {
    id: "glovo",
    name: "Glovo",
    docsHint: "Requiere Glovo Partners API + acuerdo comercial",
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    docsHint: "Requiere Uber Eats Marketplace API + onboarding",
  },
];
