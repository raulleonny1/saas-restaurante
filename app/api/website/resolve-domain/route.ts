import { restGetDocument } from "@/lib/firestore-rest";
import { normalizeHost } from "@/modules/website/domain/slug";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const host = new URL(req.url).searchParams.get("host");
  if (!host) {
    return NextResponse.json({ error: "host required" }, { status: 400 });
  }
  const normalized = normalizeHost(host);
  const doc = await restGetDocument(`customDomains/${normalized}`);
  if (!doc?.slug || typeof doc.slug !== "string") {
    return NextResponse.json({ slug: null }, { status: 404 });
  }
  if (doc.status && doc.status !== "active" && doc.status !== "pending_dns") {
    // Allow pending_dns for testing after CNAME is set
  }
  return NextResponse.json({
    slug: doc.slug,
    restaurantId: doc.restaurantId ?? null,
    status: doc.status ?? null,
  });
}
