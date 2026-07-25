import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { isValidStaffPin, normalizeStaffPin } from "@/lib/pin";
import { normalizeRoleId } from "@/lib/roles";
import { buildMemberPermissionCache } from "@/lib/rbac/evaluate";

/**
 * Activa o actualiza el PIN (6 dígitos) de un dueño/empleado ya dado de alta.
 * Usa Admin SDK: crea Auth o cambia la contraseña al PIN.
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

  let body: { email?: string; pin?: string };
  try {
    body = (await req.json()) as { email?: string; pin?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const pin = normalizeStaffPin(body.pin ?? "");
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Correo inválido" }, { status: 400 });
  }
  if (!isValidStaffPin(pin)) {
    return NextResponse.json(
      { ok: false, error: "El PIN debe ser exactamente 6 dígitos" },
      { status: 400 },
    );
  }

  const db = admin.firestore();
  const stamp = new Date().toISOString();

  type StaffHit = {
    displayName: string;
    roleId: string;
    restaurantId?: string;
    restaurantName?: string;
    employeeId?: string;
    branchIds?: string[];
  };

  let hit: StaffHit | null = null;

  const idxSnap = await db.collection("employeeEmailIndex").doc(email).get();
  if (idxSnap.exists) {
    const d = idxSnap.data()!;
    hit = {
      displayName: String(d.name || email.split("@")[0]),
      roleId: String(normalizeRoleId(d.roleId) || "camarero"),
      restaurantId: String(d.restaurantId || ""),
      employeeId: d.employeeId ? String(d.employeeId) : undefined,
      branchIds: Array.isArray(d.branchIds) ? d.branchIds : [],
    };
  }

  if (!hit) {
    const invSnap = await db
      .collection("memberInvites")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!invSnap.empty) {
      const d = invSnap.docs[0]!.data();
      hit = {
        displayName: email.split("@")[0] || "Usuario",
        roleId: String(normalizeRoleId(d.roleId) || "camarero"),
        restaurantId: String(d.restaurantId || ""),
        restaurantName: String(d.restaurantName || ""),
        branchIds: Array.isArray(d.branchIds) ? d.branchIds : [],
      };
    }
  }

  if (!hit) {
    const ptSnap = await db
      .collection("platformTenants")
      .where("ownerEmail", "==", email)
      .limit(1)
      .get();
    if (!ptSnap.empty) {
      const d = ptSnap.docs[0]!.data();
      hit = {
        displayName: String(d.ownerName || email.split("@")[0]),
        roleId: "propietario",
        restaurantId: String(d.id || ptSnap.docs[0]!.id),
        restaurantName: String(d.name || ""),
      };
    }
  }

  if (!hit) {
    const userSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!userSnap.empty) {
      const d = userSnap.docs[0]!.data();
      const ids = (d.restaurantIds as string[]) || [];
      if (ids.length || d.role === "super_admin" || d.isSuperAdmin === true) {
        hit = {
          displayName: String(d.displayName || email.split("@")[0]),
          roleId: String(normalizeRoleId(d.role) || "propietario"),
          restaurantId: ids[0],
        };
      }
    }
  }

  if (!hit) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Este correo no está dado de alta. Pide al dueño o superadmin que te registre primero.",
      },
      { status: 404 },
    );
  }

  if (hit.restaurantId && !hit.restaurantName) {
    const r = await db.collection("restaurants").doc(hit.restaurantId).get();
    hit.restaurantName = String(r.data()?.name || "");
  }

  const auth = admin.auth();
  let uid: string;
  let created = false;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, {
      password: pin,
      displayName: hit.displayName,
    });
  } catch {
    const createdUser = await auth.createUser({
      email,
      password: pin,
      displayName: hit.displayName,
      emailVerified: false,
    });
    uid = createdUser.uid;
    created = true;
  }

  const userRef = db.collection("users").doc(uid);
  const prev = await userRef.get();
  const prevIds = prev.exists
    ? ((prev.data()?.restaurantIds as string[]) || [])
    : [];
  const restaurantIds =
    hit.restaurantId && !prevIds.includes(hit.restaurantId)
      ? [...prevIds, hit.restaurantId]
      : prevIds;

  await userRef.set(
    {
      uid,
      email,
      displayName: hit.displayName,
      role: hit.roleId,
      restaurantIds,
      pinSetAt: stamp,
      updatedAt: stamp,
      ...(prev.exists ? {} : { createdAt: stamp }),
    },
    { merge: true },
  );

  // Membresía si hay restaurante
  if (hit.restaurantId) {
    const memberRef = db
      .collection("restaurants")
      .doc(hit.restaurantId)
      .collection("members")
      .doc(uid);
    const memberSnap = await memberRef.get();
    const cache = buildMemberPermissionCache({
      roleId: normalizeRoleId(hit.roleId) || "camarero",
    });
    if (!memberSnap.exists) {
      await memberRef.set({
        uid,
        restaurantId: hit.restaurantId,
        email,
        displayName: hit.displayName,
        role: hit.roleId,
        roleId: hit.roleId,
        branchIds: hit.branchIds ?? [],
        permissionAllow: [],
        permissionDeny: [],
        permissionsCached: cache.permissionsCached,
        permissionsVersion: cache.permissionsVersion,
        active: true,
        joinedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      });
    } else {
      await memberRef.set(
        {
          role: hit.roleId,
          roleId: hit.roleId,
          active: true,
          permissionsCached: cache.permissionsCached,
          permissionsVersion: cache.permissionsVersion,
          updatedAt: stamp,
        },
        { merge: true },
      );
    }

    if (hit.employeeId) {
      await db
        .collection("restaurants")
        .doc(hit.restaurantId)
        .collection("employees")
        .doc(hit.employeeId)
        .set({ uid, updatedAt: stamp }, { merge: true });
      await db
        .collection("employeeEmailIndex")
        .doc(email)
        .set({ status: "linked", updatedAt: stamp }, { merge: true });
    }

    // Marcar invites aceptados
    const invSnap = await db
      .collection("memberInvites")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .get();
    const batch = db.batch();
    for (const doc of invSnap.docs) {
      batch.update(doc.ref, {
        status: "accepted",
        acceptedAt: stamp,
        acceptedUid: uid,
        updatedAt: stamp,
      });
    }
    if (!invSnap.empty) await batch.commit();
  }

  return NextResponse.json({
    ok: true,
    uid,
    email,
    created,
    roleId: hit.roleId,
    restaurantId: hit.restaurantId,
    message: created
      ? "PIN creado. Ya puedes entrar."
      : "PIN actualizado. Ya puedes entrar.",
  });
}
