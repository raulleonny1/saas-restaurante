import { NextResponse } from "next/server";
import { getFirebaseAdmin, requirePlatformAdmin } from "@/lib/firebase-admin";
import {
  BILLING_PLANS,
  normalizeBillingPlanId,
  type BillingPlanId,
} from "@/types/billing";

type Body = {
  planId?: BillingPlanId | string;
};

/** Cambia el plan contratado de un tenant (Admin SDK). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requirePlatformAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const { id: restaurantId } = await ctx.params;
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const planId = normalizeBillingPlanId(body.planId);
  if (!body.planId || !(planId in BILLING_PLANS)) {
    return NextResponse.json(
      { ok: false, error: "planId debe ser trial | starter | business | enterprise" },
      { status: 400 },
    );
  }

  const admin = getFirebaseAdmin()!;
  const db = admin.firestore();
  const plan = BILLING_PLANS[planId];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  if (planId === "trial") {
    periodEnd.setDate(periodEnd.getDate() + 14);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const status = planId === "trial" ? "trialing" : "active";
  const ref = db
    .collection("restaurants")
    .doc(restaurantId)
    .collection("billing")
    .doc("current");

  const payload = {
    planId,
    requestedPlanId: planId,
    status,
    seatsIncluded: plan.seatsIncluded,
    branchesIncluded: plan.branchesIncluded,
    amountCents: plan.monthlyPriceCents,
    currentPeriodStart: stamp,
    currentPeriodEnd: periodEnd.toISOString(),
    updatedAt: stamp,
    activatedBy: gate.uid,
    ...(planId === "trial"
      ? { trialEndsAt: periodEnd.toISOString() }
      : { trialEndsAt: null }),
  };

  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      id: "current",
      restaurantId,
      currency: "EUR",
      createdAt: stamp,
      ...payload,
    });
  } else {
    await ref.update(payload);
  }

  await db
    .collection("platformTenants")
    .doc(restaurantId)
    .set(
      {
        planId,
        requestedPlanId: planId,
        amountCents: plan.monthlyPriceCents,
        status: planId === "trial" ? "trialing" : "active",
        updatedAt: stamp,
        activatedBy: gate.uid,
        activatedAt: stamp,
      },
      { merge: true },
    );

  return NextResponse.json({
    ok: true,
    restaurantId,
    planId,
    planName: plan.name,
    amountCents: plan.monthlyPriceCents,
  });
}
