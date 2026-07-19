/**
 * Unauthenticated Firestore REST reads for SEO / middleware.
 * Requires matching public security rules on target docs.
 */

function projectId() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
}

function apiKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
}

function decodeFields(
  fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>,
): Record<string, string | boolean> {
  if (!fields) return {};
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v.stringValue === "string") out[k] = v.stringValue;
    if (typeof v.booleanValue === "boolean") out[k] = v.booleanValue;
  }
  return out;
}

export async function restGetDocument(
  path: string,
): Promise<Record<string, string | boolean> | null> {
  const pid = projectId();
  const key = apiKey();
  if (!pid || !key) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}?key=${key}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    fields?: Record<string, { stringValue?: string; booleanValue?: boolean }>;
  };
  return decodeFields(data.fields);
}
