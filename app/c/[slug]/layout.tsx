import {
  CustomerAppProvider,
  CustomerShell,
} from "@/modules/customer-app";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = { params: Promise<{ slug: string }>; children: ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `App cliente · ${slug}`,
    description: "Pedidos, reservas, puntos y chat con el restaurante.",
    robots: { index: false, follow: false },
  };
}

export default async function CustomerAppLayout({ params, children }: Props) {
  const { slug } = await params;
  return (
    <CustomerAppProvider slug={slug}>
      <CustomerShell>{children}</CustomerShell>
    </CustomerAppProvider>
  );
}
