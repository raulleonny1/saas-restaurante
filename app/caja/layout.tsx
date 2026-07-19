import { CashierApp } from "@/modules/cashier";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mi caja · SmartServe",
  description: "Dashboard del cajero: cobros, cuentas y caja del día.",
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

export default function CajaLayout({ children }: { children: ReactNode }) {
  return <CashierApp>{children}</CashierApp>;
}
