import { DeliveryApp } from "@/modules/delivery";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Repartos · SmartServe",
  description: "App del repartidor: delivery y takeaway.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e1410",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return <DeliveryApp>{children}</DeliveryApp>;
}
