/**
 * FCM token registry (client writes; server sends via /api/push/send).
 * Path: users/{uid}/fcmTokens/{tokenHash}
 */

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

export type FcmTokenDoc = {
  token: string;
  platform: "web" | "android" | "ios";
  createdAt: string;
  updatedAt: string;
  userAgent?: string;
};

function tokenDocId(token: string) {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return `t_${Math.abs(h).toString(36)}_${token.slice(-8)}`;
}

export async function saveFcmToken(input: {
  uid: string;
  token: string;
  platform?: FcmTokenDoc["platform"];
}): Promise<void> {
  if (!isFirebaseConfigured() || !input.token) return;
  const stamp = new Date().toISOString();
  const id = tokenDocId(input.token);
  await setDoc(
    doc(getDb(), "users", input.uid, "fcmTokens", id),
    {
      token: input.token,
      platform: input.platform ?? "web",
      createdAt: stamp,
      updatedAt: stamp,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : undefined,
    },
    { merge: true },
  );
}

export async function removeFcmToken(uid: string, token: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await deleteDoc(
    doc(getDb(), "users", uid, "fcmTokens", tokenDocId(token)),
  );
}

export async function listFcmTokensForUid(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(getDb(), "users", uid, "fcmTokens"));
  return snap.docs
    .map((d) => (d.data() as FcmTokenDoc).token)
    .filter(Boolean);
}

/**
 * Solicita permiso y registra token si hay VAPID + messaging en el proyecto.
 * Sin NEXT_PUBLIC_FIREBASE_VAPID_KEY → no-op (inbox Firestore sigue como fallback).
 */
export async function registerWebPushToken(uid: string): Promise<string | null> {
  if (typeof window === "undefined" || !uid) return null;
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid || !isFirebaseConfigured()) return null;
  try {
    const { getApps } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import(
      "firebase/messaging"
    );
    if (!(await isSupported())) return null;
    const app = getApps()[0];
    if (!app) return null;
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, { vapidKey: vapid });
    if (!token) return null;
    await saveFcmToken({ uid, token, platform: "web" });
    return token;
  } catch {
    return null;
  }
}

/** Cliente: pide al API que envíe push (sin secretos en el browser). */
export async function requestPushNotify(input: {
  restaurantId: string;
  targetUids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; simulated?: boolean }> {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { ok: boolean; simulated?: boolean };
  } catch {
    return { ok: false };
  }
}
