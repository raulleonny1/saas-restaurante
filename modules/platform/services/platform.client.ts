"use client";

import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

async function authHeader(): Promise<HeadersInit> {
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase no configurado");
  const user = getAuth(app).currentUser;
  if (!user) throw new Error("Inicia sesión como super_admin");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export type PlatformTenant = {
  id: string;
  name: string;
  status: string;
  slug: string | null;
  createdAt: string;
  planId: string;
  planStatus: string;
  amountCents: number;
  owners: { uid: string; email: string; displayName: string }[];
};

export async function listPlatformTenants(): Promise<PlatformTenant[]> {
  const res = await fetch("/api/platform/tenants", {
    headers: await authHeader(),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    tenants?: PlatformTenant[];
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo listar tenants");
  }
  return data.tenants ?? [];
}

export async function provisionTenant(input: {
  ownerEmail: string;
  ownerName: string;
  restaurantName: string;
  planId: "starter" | "business" | "enterprise";
  taxId?: string;
}): Promise<{
  restaurantId: string;
  uid: string;
  email: string;
  planId: string;
  planName: string;
  slug: string;
  createdAuthUser: boolean;
  temporaryPassword?: string;
  passwordResetLink?: string;
}> {
  const res = await fetch("/api/platform/tenants", {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ ...input, sendPasswordReset: true }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    restaurantId?: string;
    uid?: string;
    email?: string;
    planId?: string;
    planName?: string;
    slug?: string;
    createdAuthUser?: boolean;
    temporaryPassword?: string;
    passwordResetLink?: string;
  };
  if (!res.ok || !data.ok || !data.restaurantId) {
    throw new Error(data.error || "No se pudo dar de alta el cliente");
  }
  return {
    restaurantId: data.restaurantId,
    uid: data.uid!,
    email: data.email!,
    planId: data.planId!,
    planName: data.planName!,
    slug: data.slug!,
    createdAuthUser: Boolean(data.createdAuthUser),
    temporaryPassword: data.temporaryPassword,
    passwordResetLink: data.passwordResetLink,
  };
}

export async function setTenantPlan(
  restaurantId: string,
  planId: "starter" | "business" | "enterprise",
): Promise<void> {
  const res = await fetch(`/api/platform/tenants/${restaurantId}/plan`, {
    method: "PATCH",
    headers: await authHeader(),
    body: JSON.stringify({ planId }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo cambiar el plan");
  }
}
