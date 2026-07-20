import { NextResponse } from "next/server";

/**
 * Crea cobro en Stripe o SumUp.
 * Env: STRIPE_SECRET_KEY, SUMUP_API_KEY, SUMUP_MERCHANT_CODE
 * Sin claves → { ok: true, simulated: true } con externalRef local.
 */

type Body = {
  provider?: "stripe" | "sumup";
  restaurantId?: string;
  branchId?: string;
  orderId?: string;
  amountCents?: number;
  currency?: string;
  tipCents?: number;
  description?: string;
};

function simRef(provider: string) {
  return `${provider}_sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function chargeStripe(input: {
  amountCents: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return {
      ok: true as const,
      provider: "stripe" as const,
      externalRef: simRef("stripe"),
      simulated: true as const,
    };
  }

  const params = new URLSearchParams();
  params.set("amount", String(input.amountCents));
  params.set("currency", input.currency.toLowerCase());
  params.set("confirm", "true");
  // TPV: pago presente / captura inmediata (Terminal reader puede sustituir payment_method)
  params.set("payment_method", "pm_card_visa"); // solo si STRIPE_TEST_CONFIRM=1
  params.set("description", input.description);
  for (const [k, v] of Object.entries(input.metadata)) {
    params.set(`metadata[${k}]`, v);
  }

  // Producción: crear Intent sin confirm y devolver client_secret al Terminal/SDK
  const useTestAuto =
    process.env.STRIPE_TEST_CONFIRM === "1" || key.startsWith("sk_test");

  if (!useTestAuto) {
    const create = new URLSearchParams();
    create.set("amount", String(input.amountCents));
    create.set("currency", input.currency.toLowerCase());
    create.set(
      "payment_method_types[]",
      "card_present",
    );
    create.set("capture_method", "automatic");
    create.set("description", input.description);
    for (const [k, v] of Object.entries(input.metadata)) {
      create.set(`metadata[${k}]`, v);
    }
    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: create,
    });
    const data = (await res.json()) as {
      id?: string;
      client_secret?: string;
      error?: { message?: string };
      status?: string;
    };
    if (!res.ok || !data.id) {
      return {
        ok: false as const,
        provider: "stripe" as const,
        externalRef: "",
        simulated: false as const,
        error: data.error?.message || `Stripe ${res.status}`,
      };
    }
    return {
      ok: true as const,
      provider: "stripe" as const,
      externalRef: data.id,
      simulated: false as const,
      clientSecret: data.client_secret,
    };
  }

  // Test: PaymentIntent + confirm con método de prueba (solo sk_test)
  const createTest = new URLSearchParams();
  createTest.set("amount", String(input.amountCents));
  createTest.set("currency", input.currency.toLowerCase());
  createTest.set("payment_method_types[]", "card");
  createTest.set("description", input.description);
  for (const [k, v] of Object.entries(input.metadata)) {
    createTest.set(`metadata[${k}]`, v);
  }
  const created = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: createTest,
  });
  const pi = (await created.json()) as {
    id?: string;
    client_secret?: string;
    error?: { message?: string };
  };
  if (!created.ok || !pi.id) {
    return {
      ok: false as const,
      provider: "stripe" as const,
      externalRef: "",
      simulated: false as const,
      error: pi.error?.message || "Stripe create failed",
    };
  }

  // Confirm with test card PM — requires Stripe test helpers; if fails, return clientSecret for SDK
  const confirm = new URLSearchParams();
  confirm.set("payment_method", "pm_card_visa");
  confirm.set("return_url", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const confRes = await fetch(
    `https://api.stripe.com/v1/payment_intents/${pi.id}/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: confirm,
    },
  );
  const confData = (await confRes.json()) as {
    id?: string;
    status?: string;
    error?: { message?: string };
    client_secret?: string;
  };
  if (!confRes.ok) {
    return {
      ok: true as const,
      provider: "stripe" as const,
      externalRef: pi.id,
      simulated: false as const,
      clientSecret: pi.client_secret,
      error: confData.error?.message,
    };
  }
  return {
    ok: true as const,
    provider: "stripe" as const,
    externalRef: confData.id || pi.id,
    simulated: false as const,
    clientSecret: confData.client_secret || pi.client_secret,
  };
}

async function chargeSumup(input: {
  amountCents: number;
  currency: string;
  description: string;
  checkoutRef: string;
}) {
  const key = process.env.SUMUP_API_KEY;
  const merchant = process.env.SUMUP_MERCHANT_CODE;
  if (!key || !merchant) {
    return {
      ok: true as const,
      provider: "sumup" as const,
      externalRef: simRef("sumup"),
      simulated: true as const,
    };
  }

  const amount = (input.amountCents / 100).toFixed(2);
  const res = await fetch("https://api.sumup.com/v0.1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkout_reference: input.checkoutRef,
      amount: Number(amount),
      currency: input.currency.toUpperCase(),
      merchant_code: merchant,
      description: input.description,
    }),
  });
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    message?: string;
    error_message?: string;
  };
  if (!res.ok || !data.id) {
    return {
      ok: false as const,
      provider: "sumup" as const,
      externalRef: "",
      simulated: false as const,
      error: data.error_message || data.message || `SumUp ${res.status}`,
    };
  }
  return {
    ok: true as const,
    provider: "sumup" as const,
    externalRef: data.id,
    simulated: false as const,
    checkoutUrl: `https://pay.sumup.com/b2c/Q${data.id}`,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const provider = body.provider === "sumup" ? "sumup" : "stripe";
  const amountCents = Math.round(Number(body.amountCents) || 0);
  if (amountCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "Importe inválido" },
      { status: 400 },
    );
  }
  const currency = (body.currency || "EUR").toUpperCase();
  const tip = Math.round(Number(body.tipCents) || 0);
  const total = amountCents + tip;
  const description =
    body.description ||
    `Pedido ${body.orderId?.slice(-6) || ""} · ${body.restaurantId?.slice(-4) || ""}`;

  if (provider === "sumup") {
    const result = await chargeSumup({
      amountCents: total,
      currency,
      description,
      checkoutRef: `${body.orderId || "ord"}_${Date.now().toString(36)}`,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 402 });
  }

  const result = await chargeStripe({
    amountCents: total,
    currency,
    description,
    metadata: {
      restaurantId: body.restaurantId || "",
      branchId: body.branchId || "",
      orderId: body.orderId || "",
    },
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 402 });
}
