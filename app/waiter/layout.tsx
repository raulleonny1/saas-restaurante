import { WaiterApp } from "@/modules/waiter";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Camareros · SmartServe",
  description: "App móvil para tomar pedidos, cobrar y gestionar mesas.",
  manifest: "/manifest-waiter.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sala",
    statusBarStyle: "black-translucent",
  },
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

export default function WaiterLayout({ children }: { children: ReactNode }) {
  return <WaiterApp>{children}</WaiterApp>;
}
