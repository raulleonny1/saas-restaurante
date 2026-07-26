/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Firebase Admin singleton (server-only).
 *
 * Opciones (en este orden):
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON — JSON en UNA sola línea (o entre comillas)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH — ruta a un .json de service account
 * 3. GOOGLE_APPLICATION_CREDENTIALS — ruta a .json (ADC)
 */

import { existsSync, readFileSync } from "fs";
import { isAbsolute, resolve } from "path";

let cached: any = undefined;
let lastError: string | null = null;

export function getFirebaseAdminInitError(): string | null {
  return lastError;
}

function loadServiceAccount(): object | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    // Quita comillas envolventes si las hay
    let text = raw;
    if (
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('"') && text.endsWith('"'))
    ) {
      text = text.slice(1, -1);
    }
    // .env a veces escapa saltos: \n literales en la private_key ya vienen como \\n
    try {
      return JSON.parse(text) as object;
    } catch (e) {
      lastError = `FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido (${
        e instanceof Error ? e.message : "parse error"
      }). Ponlo en UNA línea o usa FIREBASE_SERVICE_ACCOUNT_PATH.`;
      return null;
    }
  }

  const pathEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (pathEnv) {
    const filePath = isAbsolute(pathEnv)
      ? pathEnv
      : resolve(process.cwd(), pathEnv);
    if (!existsSync(filePath)) {
      lastError = `No existe el archivo de service account: ${filePath}`;
      return null;
    }
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as object;
    } catch (e) {
      lastError = `No se pudo leer ${filePath}: ${
        e instanceof Error ? e.message : "error"
      }`;
      return null;
    }
  }

  lastError =
    "Falta FIREBASE_SERVICE_ACCOUNT_JSON (una línea) o FIREBASE_SERVICE_ACCOUNT_PATH (ruta al .json).";
  return null;
}

export function getFirebaseAdmin(): any | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require("firebase-admin");
    const apps =
      typeof admin.getApps === "function"
        ? admin.getApps()
        : Array.isArray(admin.apps)
          ? admin.apps
          : [];
    if (!apps.length) {
      const cred = loadServiceAccount();
      if (!cred) {
        cached = null;
        return null;
      }
      // private_key en .env a veces llega con \\n literales
      const asRecord = cred as { private_key?: string };
      if (typeof asRecord.private_key === "string") {
        asRecord.private_key = asRecord.private_key.replace(/\\n/g, "\n");
      }
      admin.initializeApp({
        credential: admin.credential.cert(cred),
      });
    }
    lastError = null;
    cached = admin;
    return admin;
  } catch (e) {
    lastError =
      e instanceof Error
        ? e.message
        : "No se pudo inicializar Firebase Admin";
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
        getFirebaseAdminInitError() ||
        "Firebase Admin no configurado. Añade FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH.",
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
