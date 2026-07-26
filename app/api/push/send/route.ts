import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

/**
 * Push FCM vía Admin SDK (si hay credenciales) o legacy FCM_SERVER_KEY.
 * Sin secretos → { ok: true, simulated: true }.
 */

type Body = {
  restaurantId?: string;
  targetUids?: string[];
  title?: string;
  body?: string;
  data?: Record<string, string>;
  tokens?: string[];
};

async function tokensFromAdmin(
  uids: string[],
): Promise<string[]> {
  const admin = getFirebaseAdmin();
  if (!admin || !uids.length) return [];
  const db = admin.firestore();
  const tokens: string[] = [];
  for (const uid of uids) {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("fcmTokens")
      .get();
    for (const d of snap.docs) {
      const t = d.data()?.token;
      if (typeof t === "string" && t) tokens.push(t);
    }
  }
  return tokens;
}

async function sendWithAdmin(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const admin = getFirebaseAdmin();
  if (!admin) return { sent: 0, simulated: true as const };
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data ?? {},
  });
  return { sent: res.successCount, simulated: false as const };
}

async function sendLegacy(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const key =
    process.env.FCM_SERVER_KEY || process.env.FIREBASE_FCM_SERVER_KEY;
  if (!key) return { sent: 0, simulated: true as const };
  let sent = 0;
  for (const token of tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data: data ?? {},
        }),
      });
      if (res.ok) sent += 1;
    } catch {
      /* continue */
    }
  }
  return { sent, simulated: false as const };
}

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const title = payload.title?.trim() || "SmartServe";
  const body = payload.body?.trim() || "";
  let tokens = [...(payload.tokens ?? [])];

  if (payload.targetUids?.length) {
    try {
      const more = await tokensFromAdmin(payload.targetUids);
      tokens.push(...more);
    } catch {
      /* admin no configurado */
    }
  }
  tokens = [...new Set(tokens.filter(Boolean))];

  if (!tokens.length) {
    return NextResponse.json({ ok: true, simulated: true, sent: 0 });
  }

  if (getFirebaseAdmin()) {
    try {
      const adminResult = await sendWithAdmin(
        tokens,
        title,
        body,
        payload.data,
      );
      return NextResponse.json({ ok: true, ...adminResult });
    } catch {
      /* fallback legacy */
    }
  }

  const legacy = await sendLegacy(tokens, title, body, payload.data);
  return NextResponse.json({ ok: true, ...legacy });
}
