"use client";

import { BackofficeSyncs } from "@/components/BackofficeSyncs";
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
            <BackofficeSyncs />
            <ToastViewport />
          </TenantProvider>
        </RestaurantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
