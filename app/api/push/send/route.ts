import { NextResponse } from "next/server";

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

type AdminNs = {
  apps: unknown[];
  app: () => unknown;
  initializeApp: (opts: { credential: unknown }) => unknown;
  credential: {
    cert: (c: object) => unknown;
    applicationDefault: () => unknown;
  };
  firestore: () => {
    collection: (path: string) => {
      doc: (id: string) => {
        collection: (sub: string) => {
          get: () => Promise<{
            docs: { data: () => { token?: string } }[];
          }>;
        };
      };
    };
  };
  messaging: () => {
    sendEachForMulticast: (msg: {
      tokens: string[];
      notification: { title: string; body: string };
      data: Record<string, string>;
    }) => Promise<{ successCount: number }>;
  };
};

function loadAdmin(): AdminNs | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("firebase-admin") as AdminNs;
  } catch {
    return null;
  }
}

function getAdminApp(admin: AdminNs) {
  if (admin.apps.length) return admin.app();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const cred = JSON.parse(json) as object;
    return admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  return null;
}

async function tokensFromAdmin(
  admin: AdminNs,
  uids: string[],
): Promise<string[]> {
  if (!uids.length) return [];
  const db = admin.firestore();
  const tokens: string[] = [];
  for (const uid of uids) {
    const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
    for (const d of snap.docs) {
      const t = d.data()?.token;
      if (t) tokens.push(t);
    }
  }
  return tokens;
}

async function sendWithAdmin(
  admin: AdminNs,
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
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

  const admin = loadAdmin();
  if (admin && payload.targetUids?.length) {
    try {
      if (getAdminApp(admin)) {
        const more = await tokensFromAdmin(admin, payload.targetUids);
        tokens.push(...more);
      }
    } catch {
      /* admin no configurado */
    }
  }
  tokens = [...new Set(tokens.filter(Boolean))];

  if (!tokens.length) {
    return NextResponse.json({ ok: true, simulated: true, sent: 0 });
  }

  if (admin) {
    try {
      if (getAdminApp(admin)) {
        const adminResult = await sendWithAdmin(
          admin,
          tokens,
          title,
          body,
          payload.data,
        );
        return NextResponse.json({ ok: true, ...adminResult });
      }
    } catch {
      /* fallback legacy */
    }
  }

  const legacy = await sendLegacy(tokens, title, body, payload.data);
  return NextResponse.json({ ok: true, ...legacy });
}
