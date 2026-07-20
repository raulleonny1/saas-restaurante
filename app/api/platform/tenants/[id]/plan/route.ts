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
  if (!body.planId || planId === "trial" || !(planId in BILLING_PLANS)) {
    return NextResponse.json(
      { ok: false, error: "planId debe ser starter | business | enterprise" },
      { status: 400 },
    );
  }

  const admin = getFirebaseAdmin()!;
  const plan = BILLING_PLANS[planId];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const ref = admin
    .firestore()
    .collection("restaurants")
    .doc(restaurantId)
    .collection("billing")
    .doc("current");

  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      id: "current",
      restaurantId,
      planId,
      status: "active",
      seatsIncluded: plan.seatsIncluded,
      branchesIncluded: plan.branchesIncluded,
      amountCents: plan.monthlyPriceCents,
      currency: "EUR",
      currentPeriodStart: stamp,
      currentPeriodEnd: periodEnd.toISOString(),
      createdAt: stamp,
      updatedAt: stamp,
      activatedBy: gate.uid,
    });
  } else {
    await ref.update({
      planId,
      status: "active",
      seatsIncluded: plan.seatsIncluded,
      branchesIncluded: plan.branchesIncluded,
      amountCents: plan.monthlyPriceCents,
      currentPeriodStart: stamp,
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: stamp,
      activatedBy: gate.uid,
    });
  }

  return NextResponse.json({
    ok: true,
    restaurantId,
    planId,
    planName: plan.name,
    amountCents: plan.monthlyPriceCents,
  });
}
