import { LandingPage } from "@/modules/landing/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartServe — El sistema operativo del restaurante",
  description:
    "POS, cocina, caja, reservas, web y reportes para bares y restaurantes. Empieza gratis.",
  openGraph: {
    title: "SmartServe",
    description:
      "El sistema operativo de tu restaurante. POS, cocina, caja y más.",
    images: [{ url: "/marketing/hero-pos.png" }],
  },
};

export default function HomePage() {
  return <LandingPage />;
}
