import { NextResponse } from "next/server";
import {
  getFirebaseAdmin,
  getFirebaseAdminInitError,
} from "@/lib/firebase-admin";
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
  hasAuthAccount?: boolean;
  message?: string;
};

function roleLabelOf(roleId: RoleId): string {
  return ROLE_LABELS?.[roleId] ?? roleId;
}

/**
 * Busca dueño/empleado dado de alta por correo (Admin SDK).
 */
export async function POST(req: Request) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            getFirebaseAdminInitError() ||
            "Firebase Admin no configurado. Usa FIREBASE_SERVICE_ACCOUNT_PATH y reinicia npm run dev.",
        },
        { status: 503 },
      );
    }

    let body: { email?: string };
    try {
      body = (await req.json()) as { email?: string };
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON inválido" },
        { status: 400 },
      );
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

    const pinMsg = hasAuthAccount
      ? "Ya tienes cuenta. Inicia sesión con tu PIN de 6 dígitos."
      : "Confirma tus datos y crea tu PIN de 6 dígitos.";

    // 1) Índice de empleados
    try {
      const idxSnap = await db.collection("employeeEmailIndex").doc(email).get();
      if (idxSnap.exists) {
        const d = idxSnap.data() || {};
        const restaurantId = String(d.restaurantId || "");
        let restaurantName = "";
        if (restaurantId) {
          const r = await db.collection("restaurants").doc(restaurantId).get();
          restaurantName = String(r.data()?.name || "");
        }
        const roleId = normalizeRoleId(d.roleId) ?? "camarero";
        return NextResponse.json({
          ok: true,
          found: true,
          email,
          displayName: String(d.name || email.split("@")[0] || "Usuario"),
          roleId,
          roleLabel: roleLabelOf(roleId),
          restaurantId,
          restaurantName: restaurantName || "Tu restaurante",
          source: "employee",
          hasAuthAccount,
          message: pinMsg,
        } satisfies StaffLookupResult);
      }
    } catch (e) {
      console.warn("[staff-lookup] employeeEmailIndex", e);
    }

    // 2) Invitación pendiente
    try {
      const invSnap = await db
        .collection("memberInvites")
        .where("email", "==", email)
        .where("status", "==", "pending")
        .limit(1)
        .get();
      if (!invSnap.empty) {
        const d = invSnap.docs[0]!.data();
        const roleId = normalizeRoleId(d.roleId) ?? "camarero";
        return NextResponse.json({
          ok: true,
          found: true,
          email,
          displayName: email.split("@")[0] || "Usuario",
          roleId,
          roleLabel: roleLabelOf(roleId),
          restaurantId: String(d.restaurantId || ""),
          restaurantName: String(d.restaurantName || "Tu restaurante"),
          source: "invite",
          hasAuthAccount,
          message: pinMsg,
        } satisfies StaffLookupResult);
      }
    } catch (e) {
      console.warn("[staff-lookup] memberInvites", e);
    }

    // 3) Alta plataforma (dueño) — por ownerEmail
    try {
      const ptSnap = await db
        .collection("platformTenants")
        .where("ownerEmail", "==", email)
        .limit(1)
        .get();
      if (!ptSnap.empty) {
        const d = ptSnap.docs[0]!.data();
        return NextResponse.json({
          ok: true,
          found: true,
          email,
          displayName: String(d.ownerName || email.split("@")[0] || "Propietario"),
          roleId: "propietario",
          roleLabel: roleLabelOf("propietario"),
          restaurantId: String(d.id || ptSnap.docs[0]!.id),
          restaurantName: String(d.name || "Tu restaurante"),
          source: "platform",
          hasAuthAccount,
          message: hasAuthAccount
            ? pinMsg
            : "Eres el dueño de este local. Crea tu PIN de 6 dígitos.",
        } satisfies StaffLookupResult);
      }
    } catch (e) {
      console.warn("[staff-lookup] platformTenants", e);
    }

    // 3b) Fallback: escanear platformTenants recientes (si falla el where)
    try {
      const allPt = await db.collection("platformTenants").limit(100).get();
      const match = allPt.docs.find((doc: { data: () => Record<string, unknown> }) => {
        const oe = String(doc.data()?.ownerEmail || "")
          .trim()
          .toLowerCase();
        return oe === email;
      });
      if (match) {
        const d = match.data();
        return NextResponse.json({
          ok: true,
          found: true,
          email,
          displayName: String(d.ownerName || email.split("@")[0] || "Propietario"),
          roleId: "propietario",
          roleLabel: roleLabelOf("propietario"),
          restaurantId: String(d.id || match.id),
          restaurantName: String(d.name || "Tu restaurante"),
          source: "platform",
          hasAuthAccount,
          message: hasAuthAccount
            ? pinMsg
            : "Eres el dueño de este local. Crea tu PIN de 6 dígitos.",
        } satisfies StaffLookupResult);
      }
    } catch (e) {
      console.warn("[staff-lookup] platformTenants scan", e);
    }

    // 4) Perfil users
    try {
      const userSnap = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!userSnap.empty) {
        const d = userSnap.docs[0]!.data();
        const ids = Array.isArray(d.restaurantIds) ? d.restaurantIds : [];
        const roleId = normalizeRoleId(d.role) ?? "propietario";
        const isSuper =
          roleId === "super_admin" ||
          d.isSuperAdmin === true ||
          d.isSuperAdmin === "true";
        if (ids.length > 0 || isSuper) {
          let restaurantName = "";
          if (ids[0]) {
            const r = await db.collection("restaurants").doc(String(ids[0])).get();
            restaurantName = String(r.data()?.name || "");
          }
          return NextResponse.json({
            ok: true,
            found: true,
            email,
            displayName: String(
              d.displayName || email.split("@")[0] || "Usuario",
            ),
            roleId,
            roleLabel: roleLabelOf(roleId),
            restaurantId: ids[0] ? String(ids[0]) : undefined,
            restaurantName: restaurantName || undefined,
            source: "user",
            hasAuthAccount,
            message: pinMsg,
          } satisfies StaffLookupResult);
        }
      }
    } catch (e) {
      console.warn("[staff-lookup] users", e);
    }

    // 5) Restaurants con billingEmail / members (dueño creado por API)
    try {
      const restSnap = await db.collection("restaurants").limit(200).get();
      for (const doc of restSnap.docs) {
        const members = await doc.ref
          .collection("members")
          .where("email", "==", email)
          .limit(1)
          .get();
        if (!members.empty) {
          const m = members.docs[0]!.data();
          const roleId =
            normalizeRoleId(m.roleId || m.role) ?? "propietario";
          return NextResponse.json({
            ok: true,
            found: true,
            email,
            displayName: String(
              m.displayName || email.split("@")[0] || "Usuario",
            ),
            roleId,
            roleLabel: roleLabelOf(roleId),
            restaurantId: doc.id,
            restaurantName: String(doc.data()?.name || "Tu restaurante"),
            source: "user",
            hasAuthAccount,
            message: pinMsg,
          } satisfies StaffLookupResult);
        }
      }
    } catch (e) {
      console.warn("[staff-lookup] restaurants/members", e);
    }

    return NextResponse.json({
      ok: true,
      found: false,
      email,
      message:
        "Este correo no está dado de alta. El superadmin debe dar de alta al dueño (Alta de clientes) o el dueño debe crearte en Empleados.",
    } satisfies StaffLookupResult);
  } catch (e) {
    console.error("[staff-lookup]", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Error al consultar el correo",
      },
      { status: 500 },
    );
  }
}
