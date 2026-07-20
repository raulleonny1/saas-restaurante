/**
 * Pasarela de cobro TPV: Stripe PaymentIntent / SumUp checkout.
 * Sin claves → simulated: true (demo); con claves → captura real.
 */

export type PspProvider = "stripe" | "sumup";

export type PspChargeRequest = {
  provider: PspProvider;
  restaurantId: string;
  branchId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  tipCents?: number;
  description?: string;
};

export type PspChargeResult = {
  ok: boolean;
  provider: PspProvider;
  externalRef: string;
  simulated: boolean;
  clientSecret?: string;
  checkoutUrl?: string;
  error?: string;
};

export async function chargeViaPsp(
  input: PspChargeRequest,
): Promise<PspChargeResult> {
  const res = await fetch("/api/payments/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as PspChargeResult & { error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Error en pasarela de pago");
  }
  return data;
}

/** Mapea método UI → proveedor PSP (card usa Stripe si está habilitado). */
export function pspForMethod(
  method: string,
): PspProvider | null {
  if (method === "stripe" || method === "card") return "stripe";
  if (method === "sumup") return "sumup";
  return null;
}
