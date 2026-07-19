import { restGetDocument } from "@/lib/firestore-rest";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const index = await restGetDocument(`restaurantSlugs/${slug}`);
  if (!index?.restaurantId || typeof index.restaurantId !== "string") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const settings = await restGetDocument(
    `restaurants/${index.restaurantId}/websiteSettings/default`,
  );

  return NextResponse.json({
    slug,
    restaurantId: index.restaurantId,
    restaurantName: index.restaurantName ?? slug,
    published: index.published !== false,
    title:
      (settings?.seoTitle as string) ||
      (typeof settings?.title === "string" ? settings.title : null) ||
      `${index.restaurantName || slug} | SmartServe`,
    description:
      (typeof settings?.description === "string"
        ? settings.description
        : null) ||
      `Carta, reservas y pedidos online de ${index.restaurantName || slug}.`,
    noIndex: settings?.noIndex === true,
  });
}
