import { NextResponse } from "next/server";
import { getFirebaseAdmin, requirePlatformAdmin } from "@/lib/firebase-admin";
import { createId } from "@/lib/id";
import { buildMemberPermissionCache } from "@/lib/rbac/evaluate";
import { slugify } from "@/modules/website/domain/slug";
import {
  BILLING_PLANS,
  normalizeBillingPlanId,
  type BillingPlanId,
} from "@/types/billing";
import { DEFAULT_RESTAURANT_SETTINGS } from "@/types/restaurant";

type ProvisionBody = {
  ownerEmail?: string;
  ownerName?: string;
  restaurantName?: string;
  planId?: BillingPlanId | string;
  /** Si true, genera enlace de restablecer contraseña (recomendado). */
  sendPasswordReset?: boolean;
  taxId?: string;
};

function nowIso() {
  return new Date().toISOString();
}

/** Lista tenants (restaurantes) de la plataforma. */
export async function GET(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const admin = getFirebaseAdmin()!;
  const snap = await admin.firestore().collection("restaurants").limit(300).get();
  const tenants = await Promise.all(
    snap.docs.map(async (d: { id: string; data: () => Record<string, unknown>; ref: any }) => {
      const data = d.data();
      const billingSnap = await d.ref.collection("billing").doc("current").get();
      const billing = billingSnap.exists ? billingSnap.data() : null;
      const membersSnap = await d.ref
        .collection("members")
        .where("roleId", "==", "propietario")
        .limit(3)
        .get();
      const owners = membersSnap.docs.map((m: { id: string; data: () => Record<string, unknown> }) => {
        const md = m.data();
        return {
          uid: m.id,
          email: String(md.email || ""),
          displayName: String(md.displayName || ""),
        };
      });
      const planId = normalizeBillingPlanId(String(billing?.planId || "trial"));
      const requestedPlanId = normalizeBillingPlanId(
        String(billing?.requestedPlanId || planId),
      );
      const planStatus = String(billing?.status || "—");
      const needsActivation =
        requestedPlanId !== "trial" &&
        (planId === "trial" || planStatus === "trialing") &&
        planId !== requestedPlanId;

      return {
        id: d.id,
        name: String(data.name || ""),
        status: String(data.status || "active"),
        slug: data.slug ? String(data.slug) : null,
        createdAt: String(data.createdAt || ""),
        planId,
        requestedPlanId,
        planStatus,
        needsActivation,
        amountCents: Number(
          billing?.amountCents ?? BILLING_PLANS[requestedPlanId].monthlyPriceCents,
        ),
        owners,
      };
    }),
  );

  tenants.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ ok: true, tenants });
}

/**
 * Alta de cliente: Auth user (propietario) + restaurante + plan contratado.
 * Solo super_admin / platformAdmins.
 */
export async function POST(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  let body: ProvisionBody;
  try {
    body = (await req.json()) as ProvisionBody;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = body.ownerEmail?.trim().toLowerCase();
  const restaurantName = body.restaurantName?.trim();
  const ownerName =
    body.ownerName?.trim() || email?.split("@")[0] || "Propietario";
  const planId = normalizeBillingPlanId(body.planId || "starter");

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "Correo del propietario inválido" },
      { status: 400 },
    );
  }
  if (!restaurantName) {
    return NextResponse.json(
      { ok: false, error: "Nombre del restaurante obligatorio" },
      { status: 400 },
    );
  }
  if (planId === "trial") {
    return NextResponse.json(
      {
        ok: false,
        error: "Elige un plan de pago: starter, business o enterprise",
      },
      { status: 400 },
    );
  }

  const admin = getFirebaseAdmin()!;
  const auth = admin.auth();
  const db = admin.firestore();
  const stamp = nowIso();
  const plan = BILLING_PLANS[planId];

  let uid: string;
  let createdAuthUser = false;
  let temporaryPassword: string | undefined;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    temporaryPassword = `Ss-${Math.random().toString(36).slice(2, 8)}A1!`;
    const created = await auth.createUser({
      email,
      password: temporaryPassword,
      displayName: ownerName,
      emailVerified: false,
    });
    uid = created.uid;
    createdAuthUser = true;
  }

  const restaurantId = createId("rest");
  const branchId = createId("branch");
  const baseSlug = slugify(restaurantName) || "restaurante";
  const slug = `${baseSlug}-${restaurantId.slice(-6).toLowerCase()}`;

  const userSnap = await db.collection("users").doc(uid).get();
  const prevIds = userSnap.exists
    ? ((userSnap.data()?.restaurantIds as string[]) || [])
    : [];
  const restaurantIds = prevIds.includes(restaurantId)
    ? prevIds
    : [...prevIds, restaurantId];

  const memberCache = buildMemberPermissionCache({ roleId: "propietario" });

  const restaurant = {
    id: restaurantId,
    name: restaurantName,
    legalName: restaurantName,
    taxId: body.taxId?.trim() || undefined,
    timezone: "Europe/Madrid",
    currency: "EUR",
    status: "active",
    createdAt: stamp,
    updatedAt: stamp,
    settings: {
      ...DEFAULT_RESTAURANT_SETTINGS,
      defaultBranchId: branchId,
    },
    slug,
    websitePublished: true,
    deletedAt: null,
    provisionedBy: gate.uid,
    provisionedAt: stamp,
  };

  const branch = {
    id: branchId,
    restaurantId,
    name: "Principal",
    code: "MAIN",
    timezone: "Europe/Madrid",
    currency: "EUR",
    status: "active",
    isDefault: true,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const member = {
    uid,
    restaurantId,
    email,
    displayName: ownerName,
    role: "propietario",
    roleId: "propietario",
    branchIds: [] as string[],
    permissionAllow: [] as string[],
    permissionDeny: [] as string[],
    permissionsCached: memberCache.permissionsCached,
    permissionsVersion: memberCache.permissionsVersion,
    active: true,
    joinedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const billing = {
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
    billingEmail: email,
    externalCustomerId: null,
    externalSubscriptionId: null,
    createdAt: stamp,
    updatedAt: stamp,
    activatedBy: gate.uid,
  };

  const userDoc = {
    uid,
    email,
    displayName: ownerName,
    role: "propietario",
    restaurantIds,
    createdAt: userSnap.exists
      ? String(userSnap.data()?.createdAt || stamp)
      : stamp,
    updatedAt: stamp,
  };

  const batch = db.batch();
  batch.set(db.collection("restaurants").doc(restaurantId), restaurant);
  batch.set(
    db.collection("restaurants").doc(restaurantId).collection("members").doc(uid),
    member,
  );
  batch.set(
    db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("branches")
      .doc(branchId),
    branch,
  );
  batch.set(
    db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("billing")
      .doc("current"),
    billing,
  );
  batch.set(db.collection("users").doc(uid), userDoc, { merge: true });
  batch.set(db.collection("restaurantSlugs").doc(slug), {
    slug,
    restaurantId,
    restaurantName,
    published: true,
    updatedAt: stamp,
  });

  const invId = createId("invc");
  batch.set(
    db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("invoices")
      .doc(invId),
    {
      id: invId,
      restaurantId,
      number: `SS-${restaurantId.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      planId,
      amountCents: plan.monthlyPriceCents,
      currency: "EUR",
      status: "open",
      periodStart: stamp,
      periodEnd: periodEnd.toISOString(),
      issuedAt: stamp,
      description: `Alta plataforma · Plan ${plan.name}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
  );

  batch.set(db.collection("platformTenants").doc(restaurantId), {
    id: restaurantId,
    name: restaurantName,
    ownerEmail: email,
    ownerName,
    ownerUid: uid,
    planId,
    requestedPlanId: planId,
    amountCents: plan.monthlyPriceCents,
    status: "active",
    source: "superadmin",
    createdAt: stamp,
    updatedAt: stamp,
  });

  await batch.commit();

  let passwordResetLink: string | undefined;
  if (body.sendPasswordReset !== false) {
    try {
      passwordResetLink = await auth.generatePasswordResetLink(email);
    } catch {
      /* opcional */
    }
  }

  return NextResponse.json({
    ok: true,
    restaurantId,
    uid,
    email,
    planId,
    planName: plan.name,
    slug,
    createdAuthUser,
    /** Solo si se acaba de crear el usuario Auth (muéstralo una vez). */
    temporaryPassword: createdAuthUser ? temporaryPassword : undefined,
    passwordResetLink,
  });
}
