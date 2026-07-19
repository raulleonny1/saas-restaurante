import {
  PublicSiteProvider,
} from "@/modules/website/context/PublicSiteProvider";
import { PublicSiteShell } from "@/modules/website/components/public/PublicSiteShell";
import { restGetDocument } from "@/lib/firestore-rest";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = { params: Promise<{ slug: string }>; children: ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const index = await restGetDocument(`restaurantSlugs/${slug}`);
  const name =
    (typeof index?.restaurantName === "string" && index.restaurantName) ||
    slug;
  const published = index?.published !== false;
  return {
    title: `${name} | Carta, reservas y pedidos`,
    description: `Sitio oficial de ${name}: menú, pedidos online, reservas, promociones, blog y eventos.`,
    robots: published ? undefined : { index: false, follow: false },
    openGraph: {
      title: name,
      description: `Descubre ${name} online.`,
      type: "website",
    },
  };
}

export default async function PublicRestaurantLayout({
  params,
  children,
}: Props) {
  const { slug } = await params;
  return (
    <PublicSiteProvider slug={slug}>
      <PublicSiteShell>{children}</PublicSiteShell>
    </PublicSiteProvider>
  );
}
