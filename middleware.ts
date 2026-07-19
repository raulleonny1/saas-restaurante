import { NextResponse, type NextRequest } from "next/server";

const APP_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
]);

function isPlatformHost(host: string): boolean {
  const h = host.replace(/:\d+$/, "").toLowerCase();
  if (APP_HOSTS.has(h)) return true;
  if (h.endsWith(".vercel.app")) return true;
  if (h.includes("smartserve")) return true;
  return false;
}

/**
 * Custom domain → rewrite to /r/{slug}/...
 * Resolution via internal API (Firestore public index).
 */
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (isPlatformHost(host)) return NextResponse.next();

  // Avoid loops on API / static
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/caja")
  ) {
    return NextResponse.next();
  }

  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(
      `${origin}/api/website/resolve-domain?host=${encodeURIComponent(host)}`,
      { headers: { "x-middleware-check": "1" } },
    );
    if (!res.ok) return NextResponse.next();
    const data = (await res.json()) as { slug?: string };
    if (!data.slug) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname =
      pathname === "/" ? `/r/${data.slug}` : `/r/${data.slug}${pathname}`;
    return NextResponse.rewrite(url);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
