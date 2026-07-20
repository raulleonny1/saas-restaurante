/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Firebase Admin singleton (server-only).
 * Env: FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) o GOOGLE_APPLICATION_CREDENTIALS.
 */

let cached: any = undefined;

export function getFirebaseAdmin(): any | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (json) {
        const cred = JSON.parse(json) as object;
        admin.initializeApp({
          credential: admin.credential.cert(cred),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        cached = null;
        return null;
      }
    }
    cached = admin;
    return admin;
  } catch {
    cached = null;
    return null;
  }
}

/** Verifica Bearer token y que el usuario sea super_admin de plataforma. */
export async function requirePlatformAdmin(req: Request): Promise<{
  ok: true;
  uid: string;
  email?: string;
} | { ok: false; status: number; error: string }> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error:
        "Firebase Admin no configurado. Añade FIREBASE_SERVICE_ACCOUNT_JSON en el servidor.",
    };
  }

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Falta Authorization Bearer (idToken)" };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid as string;
    const db = admin.firestore();

    const [userSnap, platformSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("platformAdmins").doc(uid).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const flag = userData?.isSuperAdmin;
    const isSuper =
      Boolean(decoded.superAdmin) ||
      flag === true ||
      flag === "true" ||
      userData?.role === "super_admin" ||
      platformSnap.exists;

    if (!isSuper) {
      return {
        ok: false,
        status: 403,
        error: "Solo super_admin de plataforma puede gestionar tenants",
      };
    }

    return { ok: true, uid, email: decoded.email as string | undefined };
  } catch {
    return { ok: false, status: 401, error: "Token inválido o expirado" };
  }
}
