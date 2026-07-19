/** Encode / decode table QR payloads for the waiter app. */

export function encodeTableQr(tableId: string): string {
  return `ss:table:${tableId}`;
}

export function parseTableQr(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const ss = text.match(/^ss:table:([A-Za-z0-9_-]+)$/i);
  if (ss?.[1]) return ss[1];

  try {
    const url = new URL(text);
    const fromQuery =
      url.searchParams.get("table") || url.searchParams.get("tableId");
    if (fromQuery) return fromQuery;
    const pathMatch = url.pathname.match(
      /\/(?:waiter\/)?(?:t|table|mesa)\/([A-Za-z0-9_-]+)/i,
    );
    if (pathMatch?.[1]) return pathMatch[1];
  } catch {
    /* not a URL */
  }

  if (/^[A-Za-z0-9_-]{6,}$/.test(text)) return text;
  return null;
}
