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
  planId: string;
  planName: string;
  amountCents: number;
  status: string;
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
          amountCents: number;
          status: string;
          createdAt: string;
          owners: { email: string }[];
        }[];
      };
      if (res.ok && data.ok && data.tenants) {
        return data.tenants.map((t) => ({
          id: t.id,
          name: t.name,
          ownerEmail: t.owners[0]?.email || "—",
          planId: t.planId,
          planName: BILLING_PLANS[t.planId as BillingPlanId]?.name || t.planId,
          amountCents: t.amountCents,
          status: t.status,
          createdAt: t.createdAt,
        }));
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
      const planId = String(x.planId || "starter");
      return {
        id: d.id,
        name: String(x.name || ""),
        ownerEmail: String(x.ownerEmail || "—"),
        planId,
        planName: BILLING_PLANS[planId as BillingPlanId]?.name || planId,
        amountCents: Number(x.amountCents || 0),
        status: String(x.status || "active"),
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
        // índice cliente para listado local
        try {
          await setDoc(
            doc(getDb(), "platformTenants", data.restaurantId),
            stripUndefined({
              id: data.restaurantId,
              name,
              ownerEmail: email,
              planId: input.planId,
              amountCents: BILLING_PLANS[input.planId].monthlyPriceCents,
              status: "active",
              createdAt: new Date().toISOString(),
            }),
          );
        } catch {
          /* ok */
        }
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
      // Si Admin no está, seguimos por Firestore cliente
      if (res.status !== 503 && data.error) {
        // 403/401 sí fallan fuerte
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
    ...createTenantBillingDocument(restaurant.id, email),
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
      amountCents: plan.monthlyPriceCents,
      status: "active",
      createdAt: stamp,
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

export async function cambiarPlanCliente(
  restaurantId: string,
  planId: "starter" | "business" | "enterprise",
): Promise<void> {
  const headers = await bearerHeaders();
  if (headers) {
    const res = await fetch(`/api/platform/tenants/${restaurantId}/plan`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ planId }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      try {
        await updateDoc(doc(getDb(), "platformTenants", restaurantId), {
          planId,
          amountCents: BILLING_PLANS[planId].monthlyPriceCents,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        /* ok */
      }
      return;
    }
    if (res.status === 503) {
      /* fallback abajo */
    } else if (data.error) {
      throw new Error(data.error);
    }
  }

  const plan = BILLING_PLANS[planId];
  const stamp = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await updateDoc(
    doc(getDb(), "restaurants", restaurantId, "billing", "current"),
    {
      planId,
      status: "active",
      seatsIncluded: plan.seatsIncluded,
      branchesIncluded: plan.branchesIncluded,
      amountCents: plan.monthlyPriceCents,
      currentPeriodStart: stamp,
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: stamp,
    },
  );
  await updateDoc(doc(getDb(), "platformTenants", restaurantId), {
    planId,
    amountCents: plan.monthlyPriceCents,
    updatedAt: stamp,
  });
}
