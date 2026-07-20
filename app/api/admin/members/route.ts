import { NextResponse } from "next/server";

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

function loadAdmin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin") as {
      apps: unknown[];
      initializeApp: (o: { credential: unknown }) => unknown;
      credential: {
        cert: (c: object) => unknown;
        applicationDefault: () => unknown;
      };
      firestore: () => {
        collection: (p: string) => {
          doc: (id: string) => {
            collection: (s: string) => {
              doc: (id: string) => {
                get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> }>;
                update: (d: object) => Promise<void>;
              };
            };
          };
        };
      };
    };
    if (!admin.apps.length) {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (json) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(json) as object),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        return null;
      }
    }
    return admin;
  } catch {
    return null;
  }
}

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

  const admin = loadAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Backend no configurado. Configura FIREBASE_SERVICE_ACCOUNT_JSON para cambiar roles.",
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
