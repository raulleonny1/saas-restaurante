"use client";

import { CrmOrderSync } from "@/modules/customers";
import { InventorySaleSync } from "@/modules/inventory";
import { MarketingSchedulerSync } from "@/modules/marketing";
import { ToastViewport } from "@/ui";
import { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { RestaurantProvider } from "./RestaurantProvider";
import { TenantProvider } from "./TenantProvider";
import { ThemeProvider } from "./ThemeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RestaurantProvider>
          <TenantProvider>
            {children}
            <InventorySaleSync />
            <CrmOrderSync />
            <MarketingSchedulerSync />
            <ToastViewport />
          </TenantProvider>
        </RestaurantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
