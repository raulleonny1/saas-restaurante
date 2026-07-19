import { WaiterApp } from "@/modules/waiter";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mi sala · SmartServe",
  description: "Dashboard del mesero: mesas, pedidos y cobro.",
  manifest: "/manifest-waiter.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mi sala",
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
