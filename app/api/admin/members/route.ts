import { NextResponse } from "next/server";
import {
  getFirebaseAdmin,
  getFirebaseAdminInitError,
} from "@/lib/firebase-admin";

/**
 * Actualización de rol/permisos de member — Admin SDK.
 * El cliente ya no debe poder elevar roles libremente.
 */

type Body = {
  restaurantId?: string;
  memberUid?: string;
  roleId?: string;
  permissionAllow?: string[];
  permissionDeny?: string[];
  callerUid?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (!body.restaurantId || !body.memberUid) {
    return NextResponse.json(
      { ok: false, error: "restaurantId y memberUid requeridos" },
      { status: 400 },
    );
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          getFirebaseAdminInitError() ||
          "Backend no configurado. Usa FIREBASE_SERVICE_ACCOUNT_PATH para cambiar roles.",
      },
      { status: 503 },
    );
  }

  const stamp = new Date().toISOString();
  const patch: Record<string, unknown> = { updatedAt: stamp };
  if (body.roleId) {
    patch.roleId = body.roleId;
    patch.role = body.roleId;
  }
  if (body.permissionAllow) patch.permissionAllow = body.permissionAllow;
  if (body.permissionDeny) patch.permissionDeny = body.permissionDeny;

  try {
    await admin
      .firestore()
      .collection("restaurants")
      .doc(body.restaurantId)
      .collection("members")
      .doc(body.memberUid)
      .update(patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
