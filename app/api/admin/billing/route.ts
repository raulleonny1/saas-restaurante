import { NextResponse } from "next/server";
import {
  getFirebaseAdmin,
  getFirebaseAdminInitError,
} from "@/lib/firebase-admin";
import {
  BILLING_PLANS,
  type BillingPlanId,
  normalizeBillingPlanId,
} from "@/types/billing";

/**
 * Cambio de plan SaaS — solo Admin SDK (no escritura directa desde cliente).
 */

type Body = {
  restaurantId?: string;
  planId?: BillingPlanId;
  action?: "changePlan" | "markInvoicePaid";
  invoiceId?: string;
  callerUid?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.restaurantId) {
    return NextResponse.json({ ok: false, error: "restaurantId requerido" }, { status: 400 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          getFirebaseAdminInitError() ||
          "Backend no configurado (FIREBASE_SERVICE_ACCOUNT_PATH). No se permite cambiar facturación desde el cliente.",
      },
      { status: 503 },
    );
  }

  const db = admin.firestore();
  const stamp = new Date().toISOString();
  const action = body.action || "changePlan";

  try {
    if (action === "markInvoicePaid") {
      if (!body.invoiceId) {
        return NextResponse.json({ ok: false, error: "invoiceId requerido" }, { status: 400 });
      }
      await db
        .collection("restaurants")
        .doc(body.restaurantId)
        .collection("invoices")
        .doc(body.invoiceId)
        .update({ status: "paid", paidAt: stamp, updatedAt: stamp });
      await db
        .collection("restaurants")
        .doc(body.restaurantId)
        .collection("billing")
        .doc("current")
        .update({ status: "active", updatedAt: stamp });
      return NextResponse.json({ ok: true });
    }

    const planId = normalizeBillingPlanId(body.planId);
    if (!body.planId || !(planId in BILLING_PLANS)) {
      return NextResponse.json({ ok: false, error: "planId inválido" }, { status: 400 });
    }
    const plan = BILLING_PLANS[planId];
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const patch = {
      planId,
      status: planId === "trial" ? "trialing" : "active",
      seatsIncluded: plan.seatsIncluded,
      branchesIncluded: plan.branchesIncluded,
      amountCents: plan.monthlyPriceCents,
      currentPeriodStart: stamp,
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: stamp,
    };
    const billingRef = db
      .collection("restaurants")
      .doc(body.restaurantId)
      .collection("billing")
      .doc("current");
    const existing = await billingRef.get();
    if (!existing.exists) {
      await billingRef.set({
        id: "current",
        restaurantId: body.restaurantId,
        ...patch,
        createdAt: stamp,
      });
    } else {
      await billingRef.update(patch);
    }

    if (plan.monthlyPriceCents > 0) {
      const invId = `invc_${Date.now().toString(36)}`;
      await db
        .collection("restaurants")
        .doc(body.restaurantId)
        .collection("invoices")
        .doc(invId)
        .set({
          id: invId,
          restaurantId: body.restaurantId,
          number: `SS-${body.restaurantId.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
          planId,
          amountCents: plan.monthlyPriceCents,
          currency: "EUR",
          status: "open",
          periodStart: stamp,
          periodEnd: periodEnd.toISOString(),
          issuedAt: stamp,
          description: `Plan ${plan.name}`,
          createdAt: stamp,
          updatedAt: stamp,
        });
    }

    return NextResponse.json({ ok: true, planId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error admin" },
      { status: 500 },
    );
  }
}
