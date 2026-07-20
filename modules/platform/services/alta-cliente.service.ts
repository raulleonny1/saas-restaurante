"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import {
  createBranchDocument,
  createRestaurantDocument,
  createTenantBillingDocument,
} from "@/models/schemas";
import { inviteMember } from "@/modules/tenant/services/members.service";
import {
  BILLING_PLANS,
  normalizeBillingPlanId,
  type BillingPlanId,
} from "@/types/billing";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

export type ClientRow = {
  id: string;
  name: string;
  ownerEmail: string;
  /** Plan activo ahora */
  planId: BillingPlanId;
  /** Plan que eligió al registrarse / contratar */
  requestedPlanId: BillingPlanId;
  planName: string;
  requestedPlanName: string;
  amountCents: number;
  status: string;
  planStatus: string;
  needsActivation: boolean;
  createdAt: string;
};

async function bearerHeaders(): Promise<HeadersInit | null> {
  try {
    const app = getFirebaseApp();
    const user = getAuth(app).currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  } catch {
    return null;
  }
}

function rowNeedsActivation(
  planId: BillingPlanId,
  requestedPlanId: BillingPlanId,
  planStatus: string,
): boolean {
  if (requestedPlanId === "trial") return false;
  return (
    planId === "trial" ||
    planStatus === "trialing" ||
    planId !== requestedPlanId
  );
}

/** Lista clientes (índice platformTenants o API Admin). */
export async function listClients(): Promise<ClientRow[]> {
  const headers = await bearerHeaders();
  if (headers) {
    try {
      const res = await fetch("/api/platform/tenants", { headers });
      const data = (await res.json()) as {
        ok?: boolean;
        tenants?: {
          id: string;
          name: string;
          planId: string;
          requestedPlanId?: string;
          amountCents: number;
          status: string;
          planStatus?: string;
          needsActivation?: boolean;
          createdAt: string;
          owners: { email: string }[];
        }[];
      };
      if (res.ok && data.ok && data.tenants) {
        return data.tenants.map((t) => {
          const planId = normalizeBillingPlanId(t.planId);
          const requestedPlanId = normalizeBillingPlanId(
            t.requestedPlanId || t.planId,
          );
          const planStatus = String(t.planStatus || t.status || "—");
          return {
            id: t.id,
            name: t.name,
            ownerEmail: t.owners[0]?.email || "—",
            planId,
            requestedPlanId,
            planName: BILLING_PLANS[planId].name,
            requestedPlanName: BILLING_PLANS[requestedPlanId].name,
            amountCents: t.amountCents,
            status: String(t.status || "—"),
            planStatus,
            needsActivation:
              t.needsActivation ??
              rowNeedsActivation(planId, requestedPlanId, planStatus),
            createdAt: t.createdAt,
          };
        });
      }
    } catch {
      /* fallback índice */
    }
  }

  if (!isFirebaseConfigured()) return [];
  const snap = await getDocs(collection(getDb(), "platformTenants"));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const planId = normalizeBillingPlanId(String(x.planId || "trial"));
      const requestedPlanId = normalizeBillingPlanId(
        String(x.requestedPlanId || x.planId || "trial"),
      );
      const status = String(x.status || "active");
      const planStatus =
        status === "pending_payment" ? "trialing" : status;
      return {
        id: d.id,
        name: String(x.name || ""),
        ownerEmail: String(x.ownerEmail || "—"),
        planId,
        requestedPlanId,
        planName: BILLING_PLANS[planId].name,
        requestedPlanName: BILLING_PLANS[requestedPlanId].name,
        amountCents: Number(
          x.amountCents ?? BILLING_PLANS[requestedPlanId].monthlyPriceCents,
        ),
        status,
        planStatus,
        needsActivation:
          status === "pending_payment" ||
          rowNeedsActivation(planId, requestedPlanId, planStatus),
        createdAt: String(x.createdAt || ""),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Alta de cliente desde el navegador (superadmin).
 * Crea restaurante + plan + invitación al correo del dueño.
 * Si hay Admin SDK, también crea el usuario Auth.
 */
export async function altaCliente(input: {
  ownerEmail: string;
  ownerName: string;
  restaurantName: string;
  planId: "starter" | "business" | "enterprise";
  invitedByUid: string;
}): Promise<{
  restaurantId: string;
  ownerEmail: string;
  planName: string;
  temporaryPassword?: string;
  passwordResetLink?: string;
  message: string;
}> {
  const email = input.ownerEmail.trim().toLowerCase();
  const name = input.restaurantName.trim();
  if (!email.includes("@")) throw new Error("Pon un correo válido");
  if (!name) throw new Error("Pon el nombre del local / restaurante");

  // 1) Intentar API (crea también usuario Auth)
  const headers = await bearerHeaders();
  if (headers) {
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ownerEmail: email,
          ownerName: input.ownerName.trim() || email.split("@")[0],
          restaurantName: name,
          planId: input.planId,
          sendPasswordReset: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        restaurantId?: string;
        planName?: string;
        temporaryPassword?: string;
        passwordResetLink?: string;
        createdAuthUser?: boolean;
      };
      if (res.ok && data.ok && data.restaurantId) {
        return {
          restaurantId: data.restaurantId,
          ownerEmail: email,
          planName: data.planName || BILLING_PLANS[input.planId].name,
          temporaryPassword: data.temporaryPassword,
          passwordResetLink: data.passwordResetLink,
          message: data.createdAuthUser
            ? "Cliente creado. Entrégale el correo y la contraseña temporal."
            : "Cliente creado. El correo ya tenía cuenta: ya puede entrar.",
        };
      }
      if (res.status !== 503 && data.error) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(data.error);
        }
      }
    } catch (e) {
      if (e instanceof Error && /super_admin|Bearer|Token|403|401/i.test(e.message)) {
        throw e;
      }
    }
  }

  // 2) Fallback: alta solo Firestore (el cliente se registra después con ese email)
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase no está configurado");
  }

  const restaurant = createRestaurantDocument(name);
  const branch = createBranchDocument(restaurant.id, "Principal", {
    code: "MAIN",
    isDefault: true,
  });
  restaurant.settings.defaultBranchId = branch.id;

  const plan = BILLING_PLANS[input.planId];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const billing = {
    ...createTenantBillingDocument(restaurant.id, email, {
      requestedPlanId: input.planId,
    }),
    planId: input.planId,
    status: "active" as const,
    seatsIncluded: plan.seatsIncluded,
    branchesIncluded: plan.branchesIncluded,
    amountCents: plan.monthlyPriceCents,
    trialEndsAt: undefined,
    currentPeriodStart: stamp,
    currentPeriodEnd: periodEnd.toISOString(),
    updatedAt: stamp,
  };

  await setDoc(
    doc(getDb(), "restaurants", restaurant.id),
    stripUndefined({ ...restaurant, deletedAt: null }),
  );
  await setDoc(
    doc(getDb(), "restaurants", restaurant.id, "branches", branch.id),
    stripUndefined({ ...branch, deletedAt: null }),
  );
  await setDoc(
    doc(getDb(), "restaurants", restaurant.id, "billing", "current"),
    stripUndefined({ ...billing }),
  );
  await setDoc(
    doc(getDb(), "platformTenants", restaurant.id),
    stripUndefined({
      id: restaurant.id,
      name,
      ownerEmail: email,
      planId: input.planId,
      requestedPlanId: input.planId,
      amountCents: plan.monthlyPriceCents,
      status: "active",
      source: "superadmin",
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );

  if (restaurant.slug) {
    try {
      await setDoc(doc(getDb(), "restaurantSlugs", restaurant.slug), {
        slug: restaurant.slug,
        restaurantId: restaurant.id,
        restaurantName: name,
        published: true,
        updatedAt: stamp,
      });
    } catch {
      /* ok */
    }
  }

  await inviteMember({
    restaurantId: restaurant.id,
    restaurantName: name,
    email,
    roleId: "propietario",
    invitedBy: input.invitedByUid,
  });

  return {
    restaurantId: restaurant.id,
    ownerEmail: email,
    planName: plan.name,
    message:
      "Cliente dado de alta. Dile que se registre en /register con ESE correo y entrará como dueño del local.",
  };
}

/** Activa o cambia el plan del cliente (lo que eligió o el que indiques). */
export async function cambiarPlanCliente(
  restaurantId: string,
  planId: BillingPlanId,
): Promise<void> {
  const normalized = normalizeBillingPlanId(planId);
  const headers = await bearerHeaders();
  if (headers) {
    const res = await fetch(`/api/platform/tenants/${restaurantId}/plan`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ planId: normalized }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return;
    if (res.status === 503) {
      /* fallback abajo */
    } else if (data.error) {
      throw new Error(data.error);
    }
  }

  const plan = BILLING_PLANS[normalized];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  if (normalized === "trial") {
    periodEnd.setDate(periodEnd.getDate() + 14);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  await updateDoc(
    doc(getDb(), "restaurants", restaurantId, "billing", "current"),
    {
      planId: normalized,
      requestedPlanId: normalized,
      status: normalized === "trial" ? "trialing" : "active",
      seatsIncluded: plan.seatsIncluded,
      branchesIncluded: plan.branchesIncluded,
      amountCents: plan.monthlyPriceCents,
      currentPeriodStart: stamp,
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: stamp,
    },
  );
  await setDoc(
    doc(getDb(), "platformTenants", restaurantId),
    {
      planId: normalized,
      requestedPlanId: normalized,
      amountCents: plan.monthlyPriceCents,
      status: normalized === "trial" ? "trialing" : "active",
      updatedAt: stamp,
    },
    { merge: true },
  );
}

/** Activa exactamente el plan que el cliente eligió al registrarse. */
export async function activarPlanElegido(client: ClientRow): Promise<void> {
  await cambiarPlanCliente(client.id, client.requestedPlanId);
}
