import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { normalizeRoleId, ROLE_LABELS } from "@/lib/roles";
import type { RoleId } from "@/types/rbac";

export type StaffLookupResult = {
  ok: true;
  found: boolean;
  email: string;
  displayName?: string;
  roleId?: RoleId;
  roleLabel?: string;
  restaurantId?: string;
  restaurantName?: string;
  source?: "employee" | "invite" | "platform" | "user";
  /** Ya tiene cuenta Auth → debe ir a login con su PIN. */
  hasAuthAccount?: boolean;
  message?: string;
};

/**
 * Busca dueño/empleado dado de alta por correo (Admin SDK).
 * Público (sin sesión): solo datos necesarios para activar el PIN.
 */
export async function POST(req: Request) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Firebase Admin no configurado. Añade FIREBASE_SERVICE_ACCOUNT_JSON en el servidor.",
      },
      { status: 503 },
    );
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "Correo inválido" },
      { status: 400 },
    );
  }

  const db = admin.firestore();
  let hasAuthAccount = false;
  try {
    await admin.auth().getUserByEmail(email);
    hasAuthAccount = true;
  } catch {
    hasAuthAccount = false;
  }

  // 1) Índice de empleados
  const idxSnap = await db.collection("employeeEmailIndex").doc(email).get();
  if (idxSnap.exists) {
    const d = idxSnap.data()!;
    const restaurantId = String(d.restaurantId || "");
    let restaurantName = "";
    if (restaurantId) {
      const r = await db.collection("restaurants").doc(restaurantId).get();
      restaurantName = String(r.data()?.name || "");
    }
    const roleId = normalizeRoleId(d.roleId) ?? "camarero";
    const payload: StaffLookupResult = {
      ok: true,
      found: true,
      email,
      displayName: String(d.name || email.split("@")[0]),
      roleId,
      roleLabel: ROLE_LABELS[roleId] ?? roleId,
      restaurantId,
      restaurantName: restaurantName || "Tu restaurante",
      source: "employee",
      hasAuthAccount,
      message: hasAuthAccount
        ? "Ya tienes cuenta. Inicia sesión con tu PIN de 6 dígitos."
        : "Confirma tus datos y crea tu PIN de 6 dígitos.",
    };
    return NextResponse.json(payload);
  }

  // 2) Invitación pendiente
  const invSnap = await db
    .collection("memberInvites")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!invSnap.empty) {
    const d = invSnap.docs[0]!.data();
    const roleId = normalizeRoleId(d.roleId) ?? "camarero";
    const payload: StaffLookupResult = {
      ok: true,
      found: true,
      email,
      displayName: email.split("@")[0],
      roleId,
      roleLabel: ROLE_LABELS[roleId] ?? roleId,
      restaurantId: String(d.restaurantId || ""),
      restaurantName: String(d.restaurantName || "Tu restaurante"),
      source: "invite",
      hasAuthAccount,
      message: hasAuthAccount
        ? "Ya tienes cuenta. Inicia sesión con tu PIN de 6 dígitos."
        : "Confirma tus datos y crea tu PIN de 6 dígitos.",
    };
    return NextResponse.json(payload);
  }

  // 3) Alta plataforma (dueño)
  const ptSnap = await db
    .collection("platformTenants")
    .where("ownerEmail", "==", email)
    .limit(1)
    .get();
  if (!ptSnap.empty) {
    const d = ptSnap.docs[0]!.data();
    const payload: StaffLookupResult = {
      ok: true,
      found: true,
      email,
      displayName: String(d.ownerName || email.split("@")[0]),
      roleId: "propietario",
      roleLabel: ROLE_LABELS.propietario,
      restaurantId: String(d.id || ptSnap.docs[0]!.id),
      restaurantName: String(d.name || "Tu restaurante"),
      source: "platform",
      hasAuthAccount,
      message: hasAuthAccount
        ? "Ya tienes cuenta. Inicia sesión con tu PIN de 6 dígitos."
        : "Eres el dueño de este local. Crea tu PIN de 6 dígitos.",
    };
    return NextResponse.json(payload);
  }

  // 4) Perfil users ya existente con local
  const userSnap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!userSnap.empty) {
    const d = userSnap.docs[0]!.data();
    const ids = (d.restaurantIds as string[]) || [];
    const roleId = normalizeRoleId(d.role) ?? "propietario";
    if (ids.length > 0 || roleId === "super_admin" || d.isSuperAdmin === true) {
      let restaurantName = "";
      if (ids[0]) {
        const r = await db.collection("restaurants").doc(ids[0]).get();
        restaurantName = String(r.data()?.name || "");
      }
      const payload: StaffLookupResult = {
        ok: true,
        found: true,
        email,
        displayName: String(d.displayName || email.split("@")[0]),
        roleId,
        roleLabel: ROLE_LABELS[roleId] ?? roleId,
        restaurantId: ids[0],
        restaurantName: restaurantName || undefined,
        source: "user",
        hasAuthAccount,
        message: hasAuthAccount
          ? "Ya tienes cuenta. Inicia sesión con tu PIN de 6 dígitos."
          : "Confirma tus datos y crea tu PIN de 6 dígitos.",
      };
      return NextResponse.json(payload);
    }
  }

  return NextResponse.json({
    ok: true,
    found: false,
    email,
    message:
      "Este correo no está dado de alta. El dueño o el superadmin debe darte de alta primero.",
  } satisfies StaffLookupResult);
}
